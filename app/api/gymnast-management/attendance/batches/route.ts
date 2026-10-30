import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// GET: Fetch batch options (distinct program+course) for location + date + time
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const sessionDate = searchParams.get('sessionDate');
  const time = searchParams.get('time');

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    const canList =
      tenantContext.isOwner ||
      tenantContext.isAdmin ||
      tenantContext.isManager ||
      tenantContext.isCoach;
    if (!canList) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    if (!locationId || !sessionDate || !time) {
      return NextResponse.json(
        { message: 'Location, session date, and time are required' },
        { status: 400 },
      );
    }

    const locationIdNum = parseInt(locationId);
    if (isNaN(locationIdNum)) {
      return NextResponse.json(
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    if (
      (tenantContext.isManager || tenantContext.isCoach) &&
      !tenantContext.isOwner &&
      !tenantContext.isAdmin
    ) {
      if (!tenantContext.locationId || locationIdNum !== tenantContext.locationId) {
        return NextResponse.json(
          { message: 'You can only load batches for your assigned center' },
          { status: 403 },
        );
      }
    }

    const date = new Date(sessionDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { message: 'Invalid session date' },
        { status: 400 },
      );
    }

    const dayOfWeek = date.getDay();
    const dayField = dayNames[dayOfWeek];

    const batches = await prisma.batch.findMany({
      where: {
        tenantId: tenantContext.tenantId,
        locationId: locationIdNum,
        isActive: true,
        [dayField]: time,
      },
      select: {
        programId: true,
        courseId: true,
        program: { select: { name: true } },
        course: { select: { courseName: true } },
      },
      orderBy: [{ programId: 'asc' }, { courseId: 'asc' }],
    });

    const seen = new Set<string>();
    const options: { value: string; label: string; programId: number; courseId: number }[] = [];
    for (const b of batches) {
      const key = `${b.programId}-${b.courseId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({
        value: key,
        label: `${b.program?.name ?? 'Program'} - ${b.course?.courseName ?? 'Course'} (${time})`,
        programId: b.programId,
        courseId: b.courseId,
      });
    }

    return NextResponse.json(options);
  } catch (error: unknown) {
    console.error('[GET /api/gymnast-management/attendance/batches] Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
