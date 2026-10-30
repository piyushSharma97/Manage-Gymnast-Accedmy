import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getParentEmailForStudent, sendPaymentReceiptEmail } from '@/services/invoice-email';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch all payments
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const studentId = searchParams.get('studentId');
  const courseId = searchParams.get('courseId');
  const invoiceId = searchParams.get('invoiceId');
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

    // Check if user has permission to view payments
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
          {
            orderid: {
              contains: query,
            },
          },
          {
            txnid: {
              contains: query,
            },
          },
        ],
      });
    }

    if (studentId) {
      whereClause.AND.push({ studentId: BigInt(studentId) });
    }

    if (courseId) {
      whereClause.AND.push({ courseId: parseInt(courseId) });
    }

    if (invoiceId) {
      whereClause.AND.push({ invoiceId: BigInt(invoiceId) });
    }

    if (locationId) {
      whereClause.AND.push({ locationId: parseInt(locationId) });
    }

    // Count total records matching the filter
    const total = await prisma.payment.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.payment.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    const payments =
      total > 0
        ? await prisma.payment.findMany({
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

    // Fetch course information for payments
    const courseIds = payments.map((p: any) => p.courseId).filter((id: number) => id);
    const courses = courseIds.length > 0
      ? await prisma.course.findMany({
          where: {
            id: { in: courseIds },
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            courseName: true,
          },
        })
      : [];

    const courseMap = new Map(courses.map((c: any) => [c.id, c]));

    // Add course information to payments
    const paymentsWithCourses = payments.map((payment: any) => ({
      ...payment,
      course: courseMap.get(payment.courseId) || null,
    }));

    return NextResponse.json(
      jsonBigInt({
        data: paymentsWithCourses,
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

// POST: Create a new payment
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

    // Check if user has permission to create payments
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
    const invoiceId = body?.invoiceId ? BigInt(body.invoiceId) : null;
    const amount = typeof body?.amount === 'number' ? body.amount : 0;
    const amountPaid = typeof body?.amountPaid === 'number' ? body.amountPaid : 0;
    const discount = typeof body?.discount === 'number' ? body.discount : 0;
    const siblingDiscount = typeof body?.siblingDiscount === 'number' ? body.siblingDiscount : 0;
    const paymentMode = body?.paymentMode || null;
    let orderid = body?.orderid || null;
    const txnid = body?.txnid || null;
    const reference = body?.reference || null;
    const remarks = body?.remarks || null;
    const receivedAt = body?.receivedAt ? new Date(body.receivedAt) : new Date();

    // If orderid is not provided but invoiceId is, generate orderid from invoice number
    // Also verify invoice exists
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId: tenantContext.tenantId!,
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { message: 'Invoice not found or access denied' },
          { status: 400 },
        );
      }

      // Generate orderid from invoice number if not provided
      if (!orderid && (invoice as any).invoiceno) {
        orderid = (invoice as any).invoiceno.replace('INV', 'O');
      }
    }

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

    if (!courseId || courseId <= 0) {
      return NextResponse.json(
        { message: 'Invalid courseId' },
        { status: 400 },
      );
    }

    if (amount < 0 || amountPaid < 0) {
      return NextResponse.json(
        { message: 'Invalid amount' },
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

    // Invoice verification is already done above when generating orderid

    const newPayment = await prisma.payment.create({
      data: {
        tenantId: tenantContext.tenantId!,
        studentId,
        locationId,
        courseId,
        invoiceId: invoiceId || null,
        amount,
        amountPaid,
        discount,
        siblingDiscount,
        paymentMode,
        orderid,
        txnid,
        reference,
        remarks,
        receivedAt,
        createdBy: tenantContext.user.id,
      } as any,
      select: {
        id: true,
        studentId: true,
        tenantId: true,
        locationId: true,
        courseId: true,
        invoiceId: true,
        paymentMode: true,
        orderid: true,
        txnid: true,
        amount: true,
        amountPaid: true,
        discount: true,
        siblingDiscount: true,
        reference: true,
        remarks: true,
        receivedAt: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
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
      } as any,
    }) as any;

    // Fetch course information
    const course = newPayment.courseId
      ? await prisma.course.findFirst({
          where: {
            id: newPayment.courseId,
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            courseName: true,
          },
        })
      : null;

    const paymentWithCourse = {
      ...newPayment,
      course,
    };

    // Update invoice status if invoiceId is provided
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId },
      });

      if (invoice) {
        const paymentsForInvoice = await prisma.payment.findMany({
          where: { invoiceId },
          select: { 
            id: true,
            amountPaid: true,
          } as any,
        }) as any[];

        const totalPaidAmount = paymentsForInvoice.reduce((sum, p) => {
          return sum + (p.amountPaid ? Number(p.amountPaid) : 0);
        }, 0);
        const invoiceAmount = invoice.amount ? Number(invoice.amount) : 0;

        let newStatus: 'Pending' | 'Paid' | 'Overdue' | 'PartiallyPaid' = 'Pending';
        if (totalPaidAmount >= invoiceAmount) {
          newStatus = 'Paid';
        } else if (totalPaidAmount > 0) {
          newStatus = 'PartiallyPaid';
        }

        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: newStatus,
            paidAt: newStatus === 'Paid' ? new Date() : invoice.paidAt,
          },
        });
      }
    }

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newPayment.id),
      entityType: 'payment',
      description: 'Payment created.',
      ipAddress: clientIp,
    });

    // Send receipt email to parent (do not fail payment if email fails)
    try {
      const parentEmail = await getParentEmailForStudent(
        prisma,
        newPayment.studentId,
        newPayment.tenantId
      );
      if (parentEmail && newPayment.amountPaid && Number(newPayment.amountPaid) > 0) {
        const studentName = [newPayment.student.firstName, newPayment.student.lastName]
          .filter(Boolean)
          .join(' ') || newPayment.student.registrationNo;
        let invoiceNo: string | null = null;
        if (invoiceId) {
          const inv = await prisma.invoice.findFirst({
            where: { id: invoiceId },
            select: { invoiceno: true },
          });
          invoiceNo = inv?.invoiceno ?? null;
        }
        await sendPaymentReceiptEmail({
          to: parentEmail,
          tenantId: newPayment.tenantId,
          academyName: newPayment.tenant.academyName,
          studentName,
          invoiceNo,
          orderId: newPayment.orderid ?? null,
          amountPaid: Number(newPayment.amountPaid),
          paymentMode: newPayment.paymentMode ?? 'Cash',
          receivedAt: newPayment.receivedAt ?? new Date(),
          courseName: paymentWithCourse.course?.courseName ?? null,
          locationName: newPayment.location?.centerName ?? undefined,
        });
        console.log(`Receipt email sent to ${parentEmail} for payment ${newPayment.id}`);
      }
    } catch (emailError: unknown) {
      console.error('Failed to send receipt email to parent:', emailError);
    }

    return NextResponse.json(jsonBigInt(paymentWithCourse));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

