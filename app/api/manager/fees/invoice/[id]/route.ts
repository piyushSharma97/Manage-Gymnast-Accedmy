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

// GET: Fetch a specific invoice by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view invoices
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const id = BigInt(idParam);
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid invoice ID' },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
            email: true,
            phone: true,
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
    });

    if (!invoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(jsonBigInt(invoice));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific invoice
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

    // Check if user has permission to update invoices
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
        { message: 'Invalid invoice ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Check if invoice exists and belongs to tenant
    const existingInvoice = await prisma.invoice.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 },
      );
    }

    const studentId = typeof body?.studentId === 'string' || typeof body?.studentId === 'number'
      ? BigInt(body.studentId)
      : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
    const batchId = typeof body?.batchId === 'number' ? body.batchId : null;
    const amount = typeof body?.amount === 'number' ? body.amount : null;
    const billingMonth = body?.billingMonth ? new Date(body.billingMonth) : null;
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    const status = body?.status;
    const paidAt = body?.paidAt ? new Date(body.paidAt) : null;
    const siblingDiscountInput = body?.siblingDiscount;
    const discountInput = body?.discount;
    const registrationInput = body?.registration;
    const siblingDiscount = toDecimal(siblingDiscountInput);
    const discount = toDecimal(discountInput);
    const registration = toDecimal(registrationInput);
    const hasSiblingDiscount = Object.prototype.hasOwnProperty.call(body, 'siblingDiscount');
    const hasDiscount = Object.prototype.hasOwnProperty.call(body, 'discount');
    const hasRegistration = Object.prototype.hasOwnProperty.call(body, 'registration');
    if (hasSiblingDiscount && isValueProvided(siblingDiscountInput) && siblingDiscount === null) {
      return NextResponse.json(
        { message: 'Invalid sibling discount' },
        { status: 400 },
      );
    }
    if (hasDiscount && isValueProvided(discountInput) && discount === null) {
      return NextResponse.json(
        { message: 'Invalid discount' },
        { status: 400 },
      );
    }
    if (hasRegistration && isValueProvided(registrationInput) && registration === null) {
      return NextResponse.json(
        { message: 'Invalid registration amount' },
        { status: 400 },
      );
    }

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

    if (amount !== null && amount < 0) {
      return NextResponse.json(
        { message: 'Invalid amount' },
        { status: 400 },
      );
    }

    if (hasSiblingDiscount && (siblingDiscount ?? 0) < 0) {
      return NextResponse.json(
        { message: 'Invalid sibling discount' },
        { status: 400 },
      );
    }

    if (hasDiscount && (discount ?? 0) < 0) {
      return NextResponse.json(
        { message: 'Invalid discount' },
        { status: 400 },
      );
    }

    if (hasRegistration && (registration ?? 0) < 0) {
      return NextResponse.json(
        { message: 'Invalid registration amount' },
        { status: 400 },
      );
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['Pending', 'Paid', 'Overdue', 'PartiallyPaid'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { message: 'Invalid status' },
          { status: 400 },
        );
      }
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

    const updateData: any = {};
    if (studentId !== null) updateData.studentId = studentId;
    if (locationId !== null) updateData.locationId = locationId;
    if (courseId !== null) updateData.courseId = courseId;
    if (courseId === null && body?.courseId === null) updateData.courseId = null;
    if (batchId !== null) updateData.batchId = batchId;
    if (batchId === null && body?.batchId === null) updateData.batchId = null;
    if (amount !== null) updateData.amount = amount;
    if (amount === null && body?.amount === null) updateData.amount = null;
    if (billingMonth !== null) updateData.billingMonth = billingMonth;
    if (dueDate !== null) updateData.dueDate = dueDate;
    if (dueDate === null && body?.dueDate === null) updateData.dueDate = null;
    if (status) updateData.status = status;
    if (paidAt !== null) updateData.paidAt = paidAt;
    if (paidAt === null && body?.paidAt === null) updateData.paidAt = null;
    if (hasSiblingDiscount) updateData.siblingDiscount = siblingDiscount ?? 0;
    if (hasDiscount) updateData.discount = discount ?? 0;
    if (hasRegistration) updateData.registration = registration ?? 0;
    updateData.updatedBy = tenantContext.user.id;

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
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
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedInvoice.id),
      entityType: 'invoice',
      description: 'Invoice updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(updatedInvoice));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific invoice
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

    // Check if user has permission to delete invoices
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = BigInt(idParam);
    
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid invoice ID' },
        { status: 400 },
      );
    }

    // Check if invoice exists and belongs to tenant
    const existingInvoice = await prisma.invoice.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 },
      );
    }

    // Check if invoice has associated payments
    const paymentsCount = await prisma.payment.count({
      where: { invoiceId: id },
    });

    if (paymentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete invoice that has associated payments' },
        { status: 400 },
      );
    }

    await prisma.invoice.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'invoice',
      description: 'Invoice deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

