import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/tracker/skill-assessment?studentId=...
 * Returns skill assessment history (events and scores) for the student.
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

    const studentIdInt = Number(studentIdParam);
    const tenantId = context.tenantId;

    const eventsToFetch = await prisma.assessmentScore.findMany({
      where: {
        studentId: studentIdInt,
        ...(tenantId ? { tenantId } : {}),
      },
      select: { eventId: true, eventdate: true },
      distinct: ['eventId', 'eventdate'],
      orderBy: { eventdate: 'desc' },
      take: limit,
    });

    const resultsByEvent: Array<{
      eventId: number;
      eventDate: string;
      scores: Array<{
        id: number;
        skillName: string;
        apparatusName: string;
        level: string | null;
        score: number;
        remark: string | null;
      }>;
    }> = [];

    for (const ev of eventsToFetch) {
      const scores = await prisma.assessmentScore.findMany({
        where: {
          studentId: studentIdInt,
          eventId: ev.eventId,
          eventdate: ev.eventdate,
          ...(tenantId ? { tenantId } : {}),
        },
        include: {
          skill: {
            select: { id: true, name: true, apparatus_name: true, color: true },
          },
        },
        orderBy: [{ skill: { apparatus_name: 'asc' } }, { skill: { name: 'asc' } }],
      });
      resultsByEvent.push({
        eventId: ev.eventId,
        eventDate: ev.eventdate.toISOString().split('T')[0],
        scores: scores.map((s) => ({
          id: s.id,
          skillName: s.skill.name,
          apparatusName: s.skill.apparatus_name || '—',
          level: s.level,
          score: s.score,
          remark: s.remark,
        })),
      });
    }

    return NextResponse.json(jsonBigInt({ data: resultsByEvent, total: resultsByEvent.length }));
  } catch (error) {
    console.error('[parent/tracker/skill-assessment]', error);
    return NextResponse.json({ message: 'Failed to fetch skill assessment' }, { status: 500 });
  }
}
