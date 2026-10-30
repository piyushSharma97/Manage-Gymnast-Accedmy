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

// GET: List all registrations (with pagination, filtering, sorting)
export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 10);
    const studentId = searchParams.get('studentId');
    const eventId = searchParams.get('eventId');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    const whereClause: any = {
      student: {
        tenantId: tenantContext.tenantId,
      },
    };

    if (studentId) {
      whereClause.studentId = BigInt(studentId);
    }

    if (eventId) {
      whereClause.eventid = parseInt(eventId, 10);
    }

    if (status) {
      whereClause.Status = status;
    }

    const total = await prisma.studentEventFee.count({ where: whereClause });

    const registrations = await prisma.studentEventFee.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            registrationNo: true,
            firstName: true,
            lastName: true,
            email: true,
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
          },
        },
      },
    });

    return NextResponse.json(
      jsonBigInt({
        data: registrations,
        pagination: {
          total,
          page,
          limit,
          hasNext: skip + registrations.length < total,
          hasPrev: page > 1,
        },
      }),
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Create new registration
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Convert studentId to BigInt to match Student.id
    const studentId = typeof body?.studentId === 'string' || typeof body?.studentId === 'number'
      ? BigInt(body.studentId)  // Changed to BigInt
      : null;
    const eventId = typeof body?.eventId === 'number' ? body.eventId : null;
    const fees = typeof body?.Fees === 'number' ? body.Fees : typeof body?.Fees === 'string' ? parseFloat(body.Fees) : null;
    let earlyBirdDisc = typeof body?.EarlyBirdDisc === 'number' ? body.EarlyBirdDisc : typeof body?.EarlyBirdDisc === 'string' ? parseFloat(body.EarlyBirdDisc) : null;
    let siblingDisc = typeof body?.SiblingDisc === 'number' ? body.SiblingDisc : typeof body?.SiblingDisc === 'string' ? parseFloat(body.SiblingDisc) : null;
    const additional = typeof body?.Additional === 'number' ? body.Additional : typeof body?.Additional === 'string' ? parseFloat(body.Additional) : null;
    const paymentMode = typeof body?.PaymentMode === 'string' ? body.PaymentMode.trim() : '';
    const comments = typeof body?.Comments === 'string' ? body.Comments.trim() : null;
    const txnid = typeof body?.txnid === 'number' ? body.txnid : typeof body?.txnid === 'string' ? parseInt(body.txnid, 10) : null;
    
    // Status mapping
    let status = 0;
    if (typeof body?.Status === 'number') {
      status = body.Status;
    } else if (typeof body?.Status === 'string') {
      const statusMap: Record<string, number> = {
        'Pending': 0,
        'Paid': 1,
        'Partial': 2,
        'Cancelled': 3,
      };
      status = statusMap[body.Status] ?? 0;
    }
    
    const depositDate = body?.depositdate ? new Date(body.depositdate) : new Date();
    const level = typeof body?.level === 'string' ? body.level.trim() : null;
    const eventType = typeof body?.eventtype === 'string' ? body.eventtype.trim() : null;
    const timing = typeof body?.timing === 'string' ? body.timing.trim() : null;

    if (!studentId) {
      return NextResponse.json({ message: 'Student ID is required' }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ message: 'Event ID is required' }, { status: 400 });
    }

    if (!paymentMode) {
      return NextResponse.json({ message: 'Payment Mode is required' }, { status: 400 });
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,  // Now both are BigInt, so this works
        tenantId: tenantContext.tenantId,
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    // Verify event exists
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    if (isExternalEventType(event.event_type)) {
      earlyBirdDisc = null;
      siblingDisc = null;
    }

    // Calculate total
    let total = fees || 0;
    if (earlyBirdDisc) total -= earlyBirdDisc;
    if (siblingDisc) total -= siblingDisc;
    if (additional) total += additional;

    // Check if registration already exists
    const existing = await prisma.studentEventFee.findFirst({
      where: {
        studentId,
        eventid: eventId,
      },
    });

    if (existing) {
      return NextResponse.json({ message: 'Student is already registered for this event' }, { status: 400 });
    }

    // Create registration
    const registration = await prisma.studentEventFee.create({
      data: {
        studentId,  // Now BigInt
        eventid: eventId,
        Fees: fees,
        EarlyBirdDisc: earlyBirdDisc,
        SiblingDisc: siblingDisc,
        Total: total,
        Additional: additional,
        PaymentMode: paymentMode,
        Comments: comments,
        txnid: txnid,
        Status: status,
        depositdate: depositDate,
        level: level,
        eventtype: eventType || event.event_type,
        timing: timing || event.time,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: tenantContext.user?.id || null,
        updatedBy: tenantContext.user?.id || null,
      },
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

    return NextResponse.json(jsonBigInt(registration), { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}