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

const toDecimal = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isValueProvided = (value: unknown) =>
  value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

// GET: Fetch all invoices
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const status = searchParams.get('status');
  const studentId = searchParams.get('studentId');
  const courseId = searchParams.get('courseId');
  const batchId = searchParams.get('batchId');
  const locationId = searchParams.get('locationId');
  const skip = (page - 1) * limit;

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view invoices
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {
      AND: [
        {
          tenantId: tenantContext.tenantId,
        },
      ],
    };

    // Search by student name (through relation)
    if (query) {
      whereClause.AND.push({
        OR: [
          {
            student: {
              firstName: {
                contains: query,
              },
            },
          },
          {
            student: {
              lastName: {
                contains: query,
              },
            },
          },
          {
            student: {
              registrationNo: {
                contains: query,
              },
            },
          },
        ],
      });
    }

    if (status) {
      whereClause.AND.push({ status: status });
    }

    if (studentId) {
      whereClause.AND.push({ studentId: BigInt(studentId) });
    }

    if (courseId) {
      whereClause.AND.push({ courseId: parseInt(courseId) });
    }

    if (batchId) {
      whereClause.AND.push({ batchId: parseInt(batchId) });
    }

    if (locationId) {
      whereClause.AND.push({ locationId: parseInt(locationId) });
    }

    // Count total records matching the filter
    const total = await prisma.invoice.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.invoice.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    const invoices =
      total > 0
        ? await prisma.invoice.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  registrationNo: true,
                },
              },
              course: {
                select: {
                  id: true,
                  courseName: true,
                },
              },
              batch: {
                select: {
                  id: true,
                },
              },
              location: {
                select: {
                  id: true,
                  centerName: true,
                },
              },
              tenant: {
                select: {
                  id: true,
                  academyName: true,
                },
              },
            },
          })
        : [];

    return NextResponse.json(
      jsonBigInt({
        data: invoices,
        pagination: {
          total,
          page,
        },
        empty: isTableEmpty,
      })
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Create a new invoice
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
    const body = await request.json();

    const studentId = typeof body?.studentId === 'string' || typeof body?.studentId === 'number' 
      ? BigInt(body.studentId) 
      : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
    const batchId = typeof body?.batchId === 'number' ? body.batchId : null;
    const amount = typeof body?.amount === 'number' ? body.amount : null;
    const billingMonth = body?.billingMonth ? new Date(body.billingMonth) : new Date();
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    const status = body?.status || 'Pending';
    const issuedAt = new Date(); // Always set to current date/time
    const paidAt = body?.paidAt ? new Date(body.paidAt) : null;
    const siblingDiscountInput = body?.siblingDiscount;
    const discountInput = body?.discount;
    const registrationInput = body?.registration;
    const siblingDiscount = toDecimal(siblingDiscountInput);
    const discount = toDecimal(discountInput);
    const registration = toDecimal(registrationInput);
    if (isValueProvided(siblingDiscountInput) && siblingDiscount === null) {
      return NextResponse.json(
        { message: 'Invalid sibling discount' },
        { status: 400 },
      );
    }
    if (isValueProvided(discountInput) && discount === null) {
      return NextResponse.json(
        { message: 'Invalid discount' },
        { status: 400 },
      );
    }
    if (isValueProvided(registrationInput) && registration === null) {
      return NextResponse.json(
        { message: 'Invalid registration amount' },
        { status: 400 },
      );
    }
    const normalizedSiblingDiscount = siblingDiscount ?? 0;
    const normalizedDiscount = discount ?? 0;
    const normalizedRegistration = registration ?? 0;

    if (!studentId || studentId <= 0) {
      return NextResponse.json(
        { message: 'Invalid studentId' },
        { status: 400 },
      );
    }

    if (!locationId || locationId <= 0) {
      return NextResponse.json(
        { message: 'Invalid locationId' },
        { status: 400 },
      );
    }

    if (amount !== null && amount < 0) {
      return NextResponse.json(
        { message: 'Invalid amount' },
        { status: 400 },
      );
    }

    if (normalizedSiblingDiscount < 0) {
      return NextResponse.json(
        { message: 'Invalid sibling discount' },
        { status: 400 },
      );
    }

    if (normalizedDiscount < 0) {
      return NextResponse.json(
        { message: 'Invalid discount' },
        { status: 400 },
      );
    }

    if (normalizedRegistration < 0) {
      return NextResponse.json(
        { message: 'Invalid registration amount' },
        { status: 400 },
      );
    }

    // Validate status
    const validStatuses = ['Pending', 'Paid', 'Overdue', 'PartiallyPaid'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { message: 'Invalid status' },
        { status: 400 },
      );
    }

    // Verify student exists and belongs to the tenant
    const student = await prisma.student.findFirst({
      where: { 
        id: studentId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found or access denied' },
        { status: 400 },
      );
    }

    // Verify location exists and belongs to the tenant
    const location = await prisma.location.findFirst({
      where: { 
        id: locationId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found or access denied' },
        { status: 400 },
      );
    }

    // Verify course exists if provided
    if (courseId) {
      const course = await prisma.course.findFirst({
        where: { 
          id: courseId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!course) {
        return NextResponse.json(
          { message: 'Course not found or access denied' },
          { status: 400 },
        );
      }
    }

    // Verify batch exists if provided
    if (batchId) {
      const batch = await prisma.batch.findFirst({
        where: { 
          id: batchId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!batch) {
        return NextResponse.json(
          { message: 'Batch not found or access denied' },
          { status: 400 },
        );
      }
    }

    // Generate tenant_autoinc: get the max tenant_autoinc for this tenant and increment
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

    const tenant_autoinc = maxInvoice ? maxInvoice.tenant_autoinc + 1 : 1;

    // Generate invoice number: INV + tenantId + courseId + "-" + tenant_autoinc
    // If courseId is not provided, use 0 as placeholder
    const courseIdForInvoice = courseId || 0;
    const invoiceno = `INV${tenantContext.tenantId}${courseIdForInvoice}-${tenant_autoinc}`;

    // Ensure invoice number is unique (shouldn't happen, but check anyway)
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceno,
        tenantId: tenantContext.tenantId!,
      },
    });

    if (existingInvoice) {
      return NextResponse.json(
        { message: 'Invoice number conflict. Please try again.' },
        { status: 500 },
      );
    }

    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceno,
        tenant_autoinc,
        tenantId: tenantContext.tenantId!,
        studentId,
        locationId,
        courseId: courseId || null,
        batchId: batchId || null,
        amount: amount !== null ? amount : null,
        siblingDiscount: normalizedSiblingDiscount,
        discount: normalizedDiscount,
        registration: normalizedRegistration,
        billingMonth,
        dueDate: dueDate || null,
        status: status as any,
        issuedAt,
        paidAt: paidAt || null,
        createdBy: tenantContext.user.id,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
          },
        },
        course: {
          select: {
            id: true,
            courseName: true,
          },
        },
        batch: {
          select: {
            id: true,
          },
        },
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
    });

    // Notify parent by email (do not fail the request if email fails)
    try {
      const parentEmail = await getParentEmailForStudent(
        prisma,
        newInvoice.studentId,
        tenantContext.tenantId!
      );
      if (parentEmail) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantContext.tenantId! },
          select: { academyName: true },
        });
        const studentName = [
          newInvoice.student.firstName,
          newInvoice.student.lastName,
        ]
          .filter(Boolean)
          .join(' ');
        await sendInvoiceGeneratedEmail({
          to: parentEmail,
          tenantId: tenantContext.tenantId!,
          academyName: tenant?.academyName || 'My Academy',
          studentName: studentName || newInvoice.student.registrationNo,
          invoiceNo: newInvoice.invoiceno,
          amount: newInvoice.amount !== null ? Number(newInvoice.amount) : null,
          dueDate: newInvoice.dueDate,
          billingMonth: newInvoice.billingMonth,
        });
        console.log(
          `Invoice generated email sent to ${parentEmail} for invoice ${newInvoice.invoiceno}`
        );
      }
    } catch (emailError: unknown) {
      console.error(
        'Failed to send invoice generated email to parent:',
        emailError
      );
    }

    return NextResponse.json(jsonBigInt(newInvoice));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

