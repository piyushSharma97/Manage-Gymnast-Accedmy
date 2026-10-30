import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

function parseYmdBoundary(s: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  if (endOfDay) {
    dt.setHours(23, 59, 59, 999);
  } else {
    dt.setHours(0, 0, 0, 0);
  }
  return dt;
}

const MAX_RANGE_DAYS = 800;
const MAX_RANGE_ROWS = 2500;

/**
 * GET /api/parent/tracker/attendance?studentId=...
 * Optional: from=YYYY-MM-DD&to=YYYY-MM-DD for calendar (filters sessionDate).
 * Returns batch schedules so the client can mark absent vs off-days.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');
  const limit = Math.min(Number(searchParams.get('limit') || 50), 500);
  const offset = Number(searchParams.get('offset') || 0);
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

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

    let sessionDateFilter: { gte?: Date; lte?: Date } | undefined;
    if (fromStr || toStr) {
      const gte = fromStr ? parseYmdBoundary(fromStr, false) : undefined;
      const lte = toStr ? parseYmdBoundary(toStr, true) : undefined;
      if ((fromStr && !gte) || (toStr && !lte)) {
        return NextResponse.json(
          { message: 'Invalid from/to date (use YYYY-MM-DD)' },
          { status: 400 },
        );
      }
      const start = gte ?? lte!;
      const end = lte ?? gte!;
      const spanMs = end.getTime() - start.getTime();
      const spanDays = spanMs / (86400 * 1000);
      if (spanDays > MAX_RANGE_DAYS || spanDays < 0) {
        return NextResponse.json(
          { message: `Date range must be within ${MAX_RANGE_DAYS} days and valid order` },
          { status: 400 },
        );
      }
      sessionDateFilter = {};
      if (gte) sessionDateFilter.gte = gte;
      if (lte) sessionDateFilter.lte = lte;
    }

    const useRange = Boolean(sessionDateFilter);

    const [attendances, totalAllTime, batches] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          studentId: studentIdBigInt,
          ...(sessionDateFilter ? { sessionDate: sessionDateFilter } : {}),
        },
        include: {
          location: { select: { centerName: true } },
        },
        orderBy: { sessionDate: 'desc' },
        take: useRange ? MAX_RANGE_ROWS : limit,
        skip: useRange ? 0 : offset,
      }),
      prisma.attendance.count({ where: { studentId: studentIdBigInt } }),
      prisma.batch.findMany({
        where: { studentId: studentIdBigInt, isActive: true },
        include: {
          course: { select: { courseName: true } },
          program: { select: { name: true } },
          location: { select: { centerName: true } },
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const data = attendances.map((a) => ({
      id: a.id.toString(),
      sessionDate: a.sessionDate.toISOString().split('T')[0],
      locationName: a.location?.centerName ?? '—',
      createdAt: a.createdAt?.toISOString(),
    }));

    const batchPayload = batches.map((b) => ({
      id: b.id,
      courseName: b.course?.courseName ?? null,
      programName: b.program?.name ?? null,
      locationName: b.location?.centerName ?? null,
      monday: b.monday,
      tuesday: b.tuesday,
      wednesday: b.wednesday,
      thursday: b.thursday,
      friday: b.friday,
      saturday: b.saturday,
      sunday: b.sunday,
    }));

    return NextResponse.json(
      jsonBigInt({
        data,
        total: totalAllTime,
        rangeCount: useRange ? attendances.length : undefined,
        batches: batchPayload,
      }),
    );
  } catch (error) {
    console.error('[parent/tracker/attendance]', error);
    return NextResponse.json({ message: 'Failed to fetch attendance' }, { status: 500 });
  }
}
