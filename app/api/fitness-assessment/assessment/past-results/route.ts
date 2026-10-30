import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import {
  fetchPastAssessmentEventKeys,
  fetchFitnessResultsStudentEventDay,
} from '@/lib/fitness-result-raw';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startEndOfDay(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET: Fetch last 4 fitness assessment results for a student (from fitness_result)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const limit = Math.min(Number(searchParams.get('limit') || 4), 4);

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { message: 'Student ID is required' },
        { status: 400 },
      );
    }

    const sid = BigInt(studentId);
    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 403 });
    }

    const eventKeys = await fetchPastAssessmentEventKeys(prisma, sid, tenantId, limit);

    const resultsByEvent: Array<{
      eventId: number;
      eventDate: string;
      scores: Array<{
        id: number;
        fitnessSkillId: number;
        skillName: string;
        level: string;
        score: number;
        achievedValue: string | null;
        remark: string | null;
      }>;
    }> = [];

    for (const key of eventKeys) {
      const { start, end } = startEndOfDay(new Date(key.assessment_day));
      const scores = await fetchFitnessResultsStudentEventDay(
        prisma,
        sid,
        key.event_id,
        tenantId,
        start,
        end,
      );

      resultsByEvent.push({
        eventId: key.event_id,
        eventDate: dayKey(new Date(key.assessment_day)),
        scores: scores.map((s) => ({
          id: s.id,
          fitnessSkillId: s.fitness_skill_id,
          skillName: s.skill_name,
          level: s.category_name ?? s.level,
          score: 0,
          achievedValue: s.achieved_value,
          remark: s.remarks,
        })),
      });
    }

    return NextResponse.json(
      jsonBigInt({
        data: resultsByEvent,
        total: resultsByEvent.length,
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
