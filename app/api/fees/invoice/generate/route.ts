import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import {
  getParentEmailForStudent,
  sendInvoiceGeneratedEmail,
} from '@/services/invoice-email';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// POST: Generate invoices for all students who attended in the previous month
export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create invoices
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);

    // Calculate previous month date range
    const today = new Date();
    const firstDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    // Find all unique students who have attendance records in the previous month
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenantId: tenantContext.tenantId!,
        sessionDate: {
          gte: firstDayOfPreviousMonth,
          lte: lastDayOfPreviousMonth,
        },
      },
      select: {
        studentId: true,
        locationId: true,
      },
      distinct: ['studentId', 'locationId'],
    });

    if (attendanceRecords.length === 0) {
      return NextResponse.json({
        message: 'No students found with attendance in the previous month',
        generated: 0,
        skipped: 0,
      });
    }

    // Get unique student IDs
    const studentIds = Array.from(new Set(attendanceRecords.map(a => a.studentId)));
    
    // Fetch student details with their courseId and name (for parent email)
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: tenantContext.tenantId!,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        locationId: true,
        courseId: true,
        firstName: true,
        lastName: true,
        registrationNo: true,
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId! },
      select: { academyName: true },
    });
    const academyName = tenant?.academyName || 'My Academy';

    // Get current max tenant_autoinc for this tenant
    const maxInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId: tenantContext.tenantId!,
      },
      orderBy: {
        tenant_autoinc: 'desc',
      },
      select: {
        tenant_autoinc: true,
      },
    });

    let currentAutoInc = maxInvoice ? maxInvoice.tenant_autoinc : 0;

    // Set billing date to today
    const billingDate = new Date();
    billingDate.setHours(0, 0, 0, 0);

    // Calculate due date: 5th of next month from billing date
    const dueDate = new Date(billingDate.getFullYear(), billingDate.getMonth() + 1, 5);
    dueDate.setHours(23, 59, 59, 999);

    // Set issuedAt to today
    const issuedAt = new Date();

    const generatedInvoices: any[] = [];
    const skippedInvoices: any[] = [];

    const sendInvoiceEmailToParent = async (
      newInvoice: { studentId: bigint; invoiceno: string; amount: unknown; dueDate: Date | null; billingMonth: Date },
      student: { id: bigint; firstName: string; lastName: string | null; registrationNo: string }
    ) => {
      try {
        const parentEmail = await getParentEmailForStudent(
          prisma,
          newInvoice.studentId,
          tenantContext.tenantId!
        );
        if (!parentEmail) return;
        const studentName = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.registrationNo;
        await sendInvoiceGeneratedEmail({
          to: parentEmail,
          tenantId: tenantContext.tenantId!,
          academyName,
          studentName,
          invoiceNo: newInvoice.invoiceno,
          amount: newInvoice.amount != null ? Number(newInvoice.amount) : null,
          dueDate: newInvoice.dueDate,
          billingMonth: newInvoice.billingMonth,
        });
        console.log(`Invoice generated email sent to ${parentEmail} for invoice ${newInvoice.invoiceno}`);
      } catch (err) {
        console.error(`Failed to send invoice email to parent for student ${student.id}:`, err);
      }
    };

    // Process each student
    for (const student of students) {
      try {
        // Skip if student has no courseId
        if (!student.courseId) {
          skippedInvoices.push({
            studentId: student.id.toString(),
            reason: 'No course assigned',
          });
          continue;
        }

        // Get the student's location from attendance (use first location found)
        const studentAttendance = attendanceRecords.find(a => a.studentId === student.id);
        const locationId = studentAttendance?.locationId || student.locationId;

        if (!locationId) {
          skippedInvoices.push({
            studentId: student.id.toString(),
            reason: 'No location found',
          });
          continue;
        }

        // Get latest batch for the student to get amount
        const latestBatch = await prisma.batch.findFirst({
          where: {
            studentId: student.id,
            tenantId: tenantContext.tenantId!,
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            amount: true,
          },
        });

        // Check if invoice already exists for this student for the billing month
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            studentId: student.id,
            tenantId: tenantContext.tenantId!,
            billingMonth: {
              gte: new Date(billingDate.getFullYear(), billingDate.getMonth(), 1),
              lt: new Date(billingDate.getFullYear(), billingDate.getMonth() + 1, 1),
            },
          },
        });

        if (existingInvoice) {
          skippedInvoices.push({
            studentId: student.id.toString(),
            reason: 'Invoice already exists for this billing month',
          });
          continue;
        }

        // Increment tenant_autoinc
        currentAutoInc += 1;

        // Generate invoice number: INV + tenantId + courseId + "-" + tenant_autoinc
        const courseIdForInvoice = student.courseId || 0;
        const invoiceno = `INV${tenantContext.tenantId}${courseIdForInvoice}-${currentAutoInc}`;

        // Verify invoice number is unique (shouldn't happen, but check anyway)
        const duplicateCheck = await prisma.invoice.findFirst({
          where: {
            invoiceno,
            tenantId: tenantContext.tenantId!,
          },
        });

        if (duplicateCheck) {
          // If duplicate, try again with incremented number
          currentAutoInc += 1;
          const newInvoiceno = `INV${tenantContext.tenantId}${courseIdForInvoice}-${currentAutoInc}`;
          
          const duplicateCheck2 = await prisma.invoice.findFirst({
            where: {
              invoiceno: newInvoiceno,
              tenantId: tenantContext.tenantId!,
            },
          });

          if (duplicateCheck2) {
            skippedInvoices.push({
              studentId: student.id.toString(),
              reason: 'Invoice number conflict',
            });
            continue;
          }

          // Create invoice with new invoice number
          const newInvoice = await prisma.invoice.create({
            data: {
              invoiceno: newInvoiceno,
              tenant_autoinc: currentAutoInc,
              tenantId: tenantContext.tenantId!,
              studentId: student.id,
              locationId,
              courseId: student.courseId,
              batchId: latestBatch?.id || null,
              amount: latestBatch?.amount ? Number(latestBatch.amount) : null,
              siblingDiscount: 0,
              discount: 0,
              registration: 0,
              billingMonth: billingDate,
              dueDate,
              status: 'Pending',
              issuedAt,
              paidAt: null,
              createdBy: tenantContext.user.id,
            },
          });

          generatedInvoices.push(jsonBigInt(newInvoice));
          await sendInvoiceEmailToParent(newInvoice, student);
        } else {
          // Create invoice
          const newInvoice = await prisma.invoice.create({
            data: {
              invoiceno,
              tenant_autoinc: currentAutoInc,
              tenantId: tenantContext.tenantId!,
              studentId: student.id,
              locationId,
              courseId: student.courseId,
              batchId: latestBatch?.id || null,
              amount: latestBatch?.amount ? Number(latestBatch.amount) : null,
              siblingDiscount: 0,
              discount: 0,
              registration: 0,
              billingMonth: billingDate,
              dueDate,
              status: 'Pending',
              issuedAt,
              paidAt: null,
              createdBy: tenantContext.user.id,
            },
          });

          generatedInvoices.push(jsonBigInt(newInvoice));
          await sendInvoiceEmailToParent(newInvoice, student);
        }
      } catch (error: any) {
        console.error(`Error generating invoice for student ${student.id}:`, error);
        skippedInvoices.push({
          studentId: student.id.toString(),
          reason: error.message || 'Unknown error',
        });
      }
    }

    // Log the bulk operation
    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: 'bulk',
      entityType: 'invoice',
      description: `Generated ${generatedInvoices.length} invoices for previous month attendance`,
      ipAddress: clientIp,
    });

    return NextResponse.json({
      message: `Successfully generated ${generatedInvoices.length} invoice(s)`,
      generated: generatedInvoices.length,
      skippedCount: skippedInvoices.length,
      invoices: generatedInvoices,
      skipped: skippedInvoices,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

