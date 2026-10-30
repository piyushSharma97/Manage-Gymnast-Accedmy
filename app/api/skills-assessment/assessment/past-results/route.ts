import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch last 4 assessment results for a student (from AssessmentScore)
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

    const sid = parseInt(studentId, 10);
    const tenantId = tenantContext.tenantId;

    // Get last N distinct (eventId, eventdate) for this student from AssessmentScore, ordered by eventdate desc
    const eventsToFetch = await prisma.assessmentScore.findMany({
      where: {
        studentId: sid,
        tenantId,
      },
      select: {
        eventId: true,
        eventdate: true,
      },
      distinct: ['eventId', 'eventdate'],
      orderBy: {
        eventdate: 'desc',
      },
      take: limit,
    });

    const resultsByEvent: Array<{
      eventId: number;
      eventDate: string;
      scores: Array<{
        id: number;
        skillId: number;
        skillName: string;
        apparatusName: string;
        level: string | null;
        score: number;
        remark: string | null;
        color: string | null;
      }>;
    }> = [];

    for (const ev of eventsToFetch) {
      const scores = await prisma.assessmentScore.findMany({
        where: {
          studentId: sid,
          eventId: ev.eventId,
          eventdate: ev.eventdate,
          tenantId,
        },
        include: {
          skill: {
            select: {
              id: true,
              name: true,
              apparatus_id: true,
              apparatus_name: true,
              color: true,
            },
          },
        },
        orderBy: [
          { skill: { apparatus_name: 'asc' } },
          { skill: { name: 'asc' } },
        ],
      });

      resultsByEvent.push({
        eventId: ev.eventId,
        eventDate: ev.eventdate.toISOString().split('T')[0],
        scores: scores.map((s) => ({
          id: s.id,
          skillId: s.skillId,
          skillName: s.skill.name,
          apparatusName: s.skill.apparatus_name || 'Unknown',
          level: s.level,
          score: s.score,
          remark: s.remark,
          color: s.skill.color ?? null,
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
