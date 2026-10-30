import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch a specific payment by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
      const { searchParams } = new URL(request.url);
      const locationId = searchParams.get('locationId');
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view payments
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const id = BigInt(idParam);
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid payment ID' },
        { status: 400 },
      );
    }

    const payment = await prisma.payment.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
        locationId: locationId ? Number(locationId) : undefined,
      },
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

    if (!payment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 },
      );
    }

    // Fetch course information
    const course = payment.courseId
      ? await prisma.course.findFirst({
          where: {
            id: payment.courseId,
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            courseName: true,
          },
        })
      : null;

    const paymentWithCourse = {
      ...payment,
      course,
    };

    return NextResponse.json(jsonBigInt(paymentWithCourse));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to update payments
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = BigInt(idParam);
    
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid payment ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 },
      );
    }

    const studentId = typeof body?.studentId === 'string' || typeof body?.studentId === 'number'
      ? BigInt(body.studentId)
      : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
    const invoiceId = body?.invoiceId ? BigInt(body.invoiceId) : null;
    const amount = typeof body?.amount === 'number' ? body.amount : null;
    const amountPaid = typeof body?.amountPaid === 'number' ? body.amountPaid : null;
    const discount = typeof body?.discount === 'number' ? body.discount : null;
    const siblingDiscount = typeof body?.siblingDiscount === 'number' ? body.siblingDiscount : null;
    const paymentMode = body?.paymentMode;
    const orderid = body?.orderid;
    const txnid = body?.txnid;
    const reference = body?.reference;
    const remarks = body?.remarks;
    const receivedAt = body?.receivedAt ? new Date(body.receivedAt) : null;

    if (studentId && studentId <= 0) {
      return NextResponse.json(
        { message: 'Invalid studentId' },
        { status: 400 },
      );
    }

    if (locationId && locationId <= 0) {
      return NextResponse.json(
        { message: 'Invalid locationId' },
        { status: 400 },
      );
    }

    if (courseId && courseId <= 0) {
      return NextResponse.json(
        { message: 'Invalid courseId' },
        { status: 400 },
      );
    }

    if (amount !== null && amount < 0) {
      return NextResponse.json(
        { message: 'Invalid amount' },
        { status: 400 },
      );
    }

    if (amountPaid !== null && amountPaid < 0) {
      return NextResponse.json(
        { message: 'Invalid amount paid' },
        { status: 400 },
      );
    }

    // Verify student exists if provided
    if (studentId) {
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
    }

    // Verify location exists if provided
    if (locationId) {
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

    // Verify invoice exists if provided
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { 
          id: invoiceId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { message: 'Invoice not found or access denied' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (studentId !== null) updateData.studentId = studentId;
    if (locationId !== null) updateData.locationId = locationId;
    if (courseId !== null) updateData.courseId = courseId;
    if (invoiceId !== null) updateData.invoiceId = invoiceId;
    if (invoiceId === null && body?.invoiceId === null) updateData.invoiceId = null;
    if (amount !== null) updateData.amount = amount;
    if (amountPaid !== null) updateData.amountPaid = amountPaid;
    if (discount !== null) updateData.discount = discount;
    if (siblingDiscount !== null) updateData.siblingDiscount = siblingDiscount;
    if (paymentMode !== undefined) updateData.paymentMode = paymentMode;
    if (orderid !== undefined) updateData.orderid = orderid;
    if (txnid !== undefined) updateData.txnid = txnid;
    if (reference !== undefined) updateData.reference = reference;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (receivedAt !== null) updateData.receivedAt = receivedAt;
    updateData.updatedBy = tenantContext.user.id;

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: updateData,
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
    const course = updatedPayment.courseId
      ? await prisma.course.findFirst({
          where: {
            id: updatedPayment.courseId,
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            courseName: true,
          },
        })
      : null;

    const paymentWithCourse = {
      ...updatedPayment,
      course,
    };

    // Update invoice status if invoiceId is provided
    if (invoiceId || existingPayment.invoiceId) {
      const invId = invoiceId || existingPayment.invoiceId;
      if (invId) {
        const invoice = await prisma.invoice.findFirst({
          where: { id: invId },
        });

        if (invoice) {
          const paymentsForInvoice = await prisma.payment.findMany({
            where: { invoiceId: invId },
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
            where: { id: invId },
            data: {
              status: newStatus,
              paidAt: newStatus === 'Paid' ? new Date() : invoice.paidAt,
            },
          });
        }
      }
    }

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedPayment.id),
      entityType: 'payment',
      description: 'Payment updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(paymentWithCourse));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete payments
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = BigInt(idParam);
    
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid payment ID' },
        { status: 400 },
      );
    }

    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { message: 'Payment not found' },
        { status: 404 },
      );
    }

    const invoiceId = existingPayment.invoiceId;

    await prisma.payment.delete({
      where: { id },
    });

    // Update invoice status if invoiceId exists
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
            paidAt: newStatus === 'Paid' ? new Date() : null,
          },
        });
      }
    }

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'payment',
      description: 'Payment deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

