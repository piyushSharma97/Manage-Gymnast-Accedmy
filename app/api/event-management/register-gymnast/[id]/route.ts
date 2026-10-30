import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { isExternalEventType } from '@/lib/event-external';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Get single registration by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const registrationId = parseInt(id, 10);

    if (isNaN(registrationId)) {
      return NextResponse.json({ message: 'Invalid registration ID' }, { status: 400 });
    }

    const registration = await prisma.studentEventFee.findFirst({
      where: {
        id: registrationId,
        student: {
          tenantId: tenantContext.tenantId,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            registrationNo: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            event_type: true,
            startdate: true,
            enddate: true,
            fees: true,
            time: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ message: 'Registration not found' }, { status: 404 });
    }

    return NextResponse.json(jsonBigInt(registration));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update registration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const registrationId = parseInt(id, 10);

    if (isNaN(registrationId)) {
      return NextResponse.json({ message: 'Invalid registration ID' }, { status: 400 });
    }

    const body = await request.json();

    // Verify the record exists and belongs to tenant
    const existing = await prisma.studentEventFee.findFirst({
      where: {
        id: registrationId,
        student: {
          tenantId: tenantContext.tenantId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Registration not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    if (body.Fees !== undefined) {
      updateData.Fees = typeof body.Fees === 'number' ? body.Fees : parseFloat(body.Fees);
    }
    if (body.EarlyBirdDisc !== undefined) {
      updateData.EarlyBirdDisc = body.EarlyBirdDisc === null ? null : (typeof body.EarlyBirdDisc === 'number' ? body.EarlyBirdDisc : parseFloat(body.EarlyBirdDisc));
    }
    if (body.SiblingDisc !== undefined) {
      updateData.SiblingDisc = body.SiblingDisc === null ? null : (typeof body.SiblingDisc === 'number' ? body.SiblingDisc : parseFloat(body.SiblingDisc));
    }
    if (body.Additional !== undefined) {
      updateData.Additional = body.Additional === null ? null : (typeof body.Additional === 'number' ? body.Additional : parseFloat(body.Additional));
    }
    if (body.PaymentMode !== undefined) {
      updateData.PaymentMode = typeof body.PaymentMode === 'string' ? body.PaymentMode.trim() : null;
    }
    if (body.Comments !== undefined) {
      updateData.Comments = typeof body.Comments === 'string' ? body.Comments.trim() : null;
    }
    if (body.txnid !== undefined) {
      updateData.txnid = typeof body.txnid === 'string' ? body.txnid.trim() : null;
    }
    if (body.Status !== undefined) {
      // Convert string status to number (matching POST route logic)
      let status = 0;
      if (typeof body.Status === 'number') {
        status = body.Status;
      } else if (typeof body.Status === 'string') {
        const statusMap: Record<string, number> = {
          'Pending': 0,
          'Paid': 1,
          'Partial': 2,
          'Cancelled': 3,
        };
        status = statusMap[body.Status.trim()] ?? 0;
      }
      updateData.Status = status;
    }
    if (body.depositdate !== undefined) {
      updateData.depositdate = body.depositdate ? new Date(body.depositdate) : null;
    }
    if (body.level !== undefined) {
      updateData.level = typeof body.level === 'string' ? body.level.trim() : null;
    }
    if (body.eventtype !== undefined) {
      updateData.eventtype = typeof body.eventtype === 'string' ? body.eventtype.trim() : null;
    }
    if (body.timing !== undefined) {
      updateData.timing = typeof body.timing === 'string' ? body.timing.trim() : null;
    }

    const linkedEvent = await prisma.event.findFirst({
      where: { id: existing.eventid, tenantId: tenantContext.tenantId! },
      select: { event_type: true },
    });
    if (isExternalEventType(linkedEvent?.event_type)) {
      updateData.EarlyBirdDisc = null;
      updateData.SiblingDisc = null;
    }

    // Recalculate total if fees or discounts changed
    if (updateData.Fees !== undefined || updateData.EarlyBirdDisc !== undefined || updateData.SiblingDisc !== undefined || updateData.Additional !== undefined) {
      const fees = updateData.Fees !== undefined ? updateData.Fees : Number(existing.Fees);
      const earlyBirdDisc = updateData.EarlyBirdDisc !== undefined ? updateData.EarlyBirdDisc : (existing.EarlyBirdDisc ? Number(existing.EarlyBirdDisc) : null);
      const siblingDisc = updateData.SiblingDisc !== undefined ? updateData.SiblingDisc : (existing.SiblingDisc ? Number(existing.SiblingDisc) : null);
      const additional = updateData.Additional !== undefined ? updateData.Additional : (existing.Additional ? Number(existing.Additional) : null);

      let total = fees;
      if (earlyBirdDisc) total -= earlyBirdDisc;
      if (siblingDisc) total -= siblingDisc;
      if (additional) total += additional;
      updateData.Total = total;
    }

    updateData.updatedBy = tenantContext.user?.id || null;

    const updated = await prisma.studentEventFee.update({
      where: { id: registrationId },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            registrationNo: true,
            firstName: true,
            lastName: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            event_type: true,
          },
        },
      },
    });

    return NextResponse.json(jsonBigInt(updated));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const registrationId = parseInt(id, 10);

    if (isNaN(registrationId)) {
      return NextResponse.json({ message: 'Invalid registration ID' }, { status: 400 });
    }

    // Verify the record exists and belongs to tenant
    const existing = await prisma.studentEventFee.findFirst({
      where: {
        id: registrationId,
        student: {
          tenantId: tenantContext.tenantId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: 'Registration not found' }, { status: 404 });
    }

    await prisma.studentEventFee.delete({
      where: { id: registrationId },
    });

    return NextResponse.json({ message: 'Registration deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}