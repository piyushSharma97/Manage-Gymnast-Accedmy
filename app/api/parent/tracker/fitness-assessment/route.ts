import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';
import { parseAchievedNumeric } from '@/lib/fitness-result-numeric';
import {
  fetchFitnessResultsStudentEventDay,
  fetchPastAssessmentEventKeys,
} from '@/lib/fitness-result-raw';

function startEndOfDay(d: Date): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(d);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { dayStart, dayEnd };
}

function averagesFromRows(
  rows: Array<{ achieved_value: string; category_name: string | null }>,
): {
  average: number | null;
  categoryAverages: Array<{ categoryName: string; average: number; count: number }>;
} {
  if (rows.length === 0) {
    return { average: null, categoryAverages: [] };
  }
  let sum = 0;
  const byCat = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const n = parseAchievedNumeric(row.achieved_value);
    sum += n;
    const cat = row.category_name?.trim() || 'Other';
    const prev = byCat.get(cat) ?? { sum: 0, count: 0 };
    prev.sum += n;
    prev.count += 1;
    byCat.set(cat, prev);
  }
  const categoryAverages = Array.from(byCat.entries())
    .map(([categoryName, { sum: s, count }]) => ({
      categoryName,
      average: count > 0 ? Math.round((s / count) * 10) / 10 : 0,
      count,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  return {
    average: Math.round((sum / rows.length) * 10) / 10,
    categoryAverages,
  };
}

/**
 * GET /api/parent/tracker/fitness-assessment?studentId=...&limit=20
 * Fitness assessment results with overall average and per-event (and per-category) averages.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');
  const limit = Math.min(Number(searchParams.get('limit') || 20), 50);

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

    const student = await prisma.student.findUnique({
      where: { id: studentIdBigInt },
      select: { tenantId: true },
    });
    if (!student?.tenantId) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const tenantId = student.tenantId;
    if (
      context.tenantId != null &&
      context.tenantId !== tenantId
    ) {
      return NextResponse.json({ message: 'You do not have access to this student' }, { status: 403 });
    }

    const keys = await fetchPastAssessmentEventKeys(prisma, studentIdBigInt, tenantId, limit);
    const eventIds = Array.from(new Set(keys.map((k) => k.event_id)));
    const eventsMeta =
      eventIds.length > 0
        ? await prisma.event.findMany({
            where: { id: { in: eventIds }, tenantId },
            select: { id: true, name: true },
          })
        : [];
    const eventNameById = new Map(eventsMeta.map((e) => [e.id, e.name]));

    const events: Array<{
      eventId: number;
      eventName: string | null;
      eventDate: string;
      average: number | null;
      categoryAverages: Array<{ categoryName: string; average: number; count: number }>;
      rows: Array<{
        id: number;
        skillName: string;
        categoryName: string;
        achievedValue: string;
        unitOfMeasurement: string | null;
        remark: string | null;
      }>;
    }> = [];

    let overallSum = 0;
    let overallCount = 0;

    for (const key of keys) {
      const { dayStart, dayEnd } = startEndOfDay(key.assessment_day);
      const rawRows = await fetchFitnessResultsStudentEventDay(
        prisma,
        studentIdBigInt,
        key.event_id,
        tenantId,
        dayStart,
        dayEnd,
      );
      const { average, categoryAverages } = averagesFromRows(rawRows);
      for (const row of rawRows) {
        overallSum += parseAchievedNumeric(row.achieved_value);
        overallCount += 1;
      }
      events.push({
        eventId: key.event_id,
        eventName: eventNameById.get(key.event_id) ?? null,
        eventDate: key.assessment_day.toISOString().split('T')[0],
        average,
        categoryAverages,
        rows: rawRows.map((r) => ({
          id: r.id,
          skillName: r.skill_name,
          categoryName: r.category_name?.trim() || 'Other',
          achievedValue: r.achieved_value,
          unitOfMeasurement: r.unit_of_measurement ?? null,
          remark: r.remarks,
        })),
      });
    }

    const overallAverage =
      overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : null;

    return NextResponse.json(
      jsonBigInt({
        overallAverage,
        overallRowCount: overallCount,
        events,
        total: events.length,
      }),
    );
  } catch (error) {
    console.error('[parent/tracker/fitness-assessment]', error);
    return NextResponse.json({ message: 'Failed to fetch fitness assessment' }, { status: 500 });
  }
}
