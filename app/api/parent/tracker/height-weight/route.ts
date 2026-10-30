import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/tracker/height-weight?studentId=...
 * Returns height/weight history from event registrations (StudentEventFee) for the student.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');

  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!context.isParent) {
      return NextResponse.json({ message: 'Parent or guardian access required' }, { status: 403 });
    }
    if (!studentIdParam) {
      return NextResponse.json({ message: 'studentId is required' }, { status: 400 });
    }

    const studentIdBigInt = BigInt(studentIdParam);
    const canAccess = await ensureParentOfStudent(context.user.id, studentIdBigInt);
    if (!canAccess) {
      return NextResponse.json({ message: 'You do not have access to this student' }, { status: 403 });
    }

    const records = await prisma.studentEventFee.findMany({
      where: {
        studentId: studentIdBigInt,
        OR: [{ height: { not: null } }, { weight: { not: null } }],
      },
      include: {
        event: { select: { id: true, name: true, event_type: true, startdate: true } },
      },
      orderBy: { depositdate: 'desc' },
    });

    const data = records.map((r) => ({
      id: r.id,
      eventName: r.event?.name,
      eventType: r.event?.event_type,
      date: r.depositdate?.toISOString().split('T')[0],
      height: r.height,
      weight: r.weight,
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return NextResponse.json(jsonBigInt({ data }));
  } catch (error) {
    console.error('[parent/tracker/height-weight]', error);
    return NextResponse.json({ message: 'Failed to fetch height/weight' }, { status: 500 });
  }
}
