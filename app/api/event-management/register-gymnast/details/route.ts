import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: unknown) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );  

// GET: Fetch registration by studentId + eventId (admin, owner, or coach for assessment)
export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner && !tenantContext.isManager && !tenantContext.isCoach)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const eventId = searchParams.get('eventId');

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'studentId and eventId are required' },
        { status: 400 },
      );
    }

    const registration = await prisma.studentEventFee.findFirst({
      where: {
        studentId: BigInt(studentId),
        eventid: parseInt(eventId, 10),
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
      return NextResponse.json(
        { message: 'Registration not found' },
        { status: 404 },
      );
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

// PATCH: Update height and weight for a registration (admin, owner, or coach for assessment)
export async function PATCH(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner && !tenantContext.isManager && !tenantContext.isCoach)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const eventId = searchParams.get('eventId');

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'studentId and eventId are required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const height = body.height != null ? Number(body.height) : undefined;
    const weight = body.weight != null ? Number(body.weight) : undefined;

    if (height !== undefined && (Number.isNaN(height) || height < 0)) {
      return NextResponse.json({ message: 'Invalid height' }, { status: 400 });
    }
    if (weight !== undefined && (Number.isNaN(weight) || weight < 0)) {
      return NextResponse.json({ message: 'Invalid weight' }, { status: 400 });
    }

    const registration = await prisma.studentEventFee.findFirst({
      where: {
        studentId: BigInt(studentId),
        eventid: parseInt(eventId, 10),
        student: { tenantId: tenantContext.tenantId },
      },
      include: { event: { select: { event_type: true } } },
    });

    if (!registration) {
      return NextResponse.json(
        { message: 'Registration not found' },
        { status: 404 },
      );
    }

    // Coach can only update for Assessment events
    if (tenantContext.isCoach && !tenantContext.isAdmin && !tenantContext.isOwner) {
      const eventType = registration.event?.event_type ?? '';
      if (!eventType.toLowerCase().includes('assessment')) {
        return NextResponse.json(
          { message: 'Coaches can only update height/weight for assessment events' },
          { status: 403 },
        );
      }
    }

    const updateData: { height?: number | null; weight?: number | null } = {};
    if (height !== undefined) updateData.height = height;
    if (weight !== undefined) updateData.weight = weight;

    const updated = await prisma.studentEventFee.update({
      where: { id: registration.id },
      data: updateData,
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