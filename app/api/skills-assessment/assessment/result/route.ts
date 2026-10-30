import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { jsonBigInt, getErrorMessage } from '@/types/api';

// GET: Fetch assessment results for a student
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const eventId = searchParams.get('eventId');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission (admin or coach)
    if (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'Student ID and Event ID are required' },
        { status: 400 },
      );
    }

    const sid = parseInt(studentId, 10);
    const eid = parseInt(eventId, 10);
    const tenantId = tenantContext.tenantId;

    // Fetch student height/weight from StudentEventFee for this event (if available)
    const studentEventFee = await prisma.studentEventFee.findFirst({
      where: {
        studentId: BigInt(sid),
        eventid: eid,
        event: { tenantId },
      },
    }).then((fee) => fee ? { height: (fee as { height?: number | null }).height ?? null, weight: (fee as { weight?: number | null }).weight ?? null } : null);

    // Fetch event (assessment) name
    const event = await prisma.event.findFirst({
      where: { id: eid, tenantId },
      select: { name: true },
    });

    // Fetch assessment comments
    const assessmentComments = await prisma.assessmentComment.findMany({
      where: {
        studentId: sid,
        eventid: eid,
        tenantId,
      },
      orderBy: {
        commentdate: 'desc',
      },
    });
    // Fetch assessment scores
const assessmentScores = await prisma.assessmentScore.findMany({
      where: {
        studentId: sid,
        eventId: eid,
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

     // Resolve level name from first score's level (level code) via SkillLevel
    const levelFromScore = assessmentScores.length > 0 ? assessmentScores[0].level : null;
    let levelName: string | null = null;
    if (levelFromScore && String(levelFromScore).trim()) {
      const skillLevel = await prisma.skillLevel.findFirst({
        where: {
          tenantId,
          OR: [
            { levelCode: levelFromScore },
            { levelName: levelFromScore },
          ],
        },
        select: { levelName: true },
      });
      levelName = skillLevel?.levelName ?? null;
    }

    // Format the response (include skill color for checkbox styling)
    const formattedResults = assessmentScores.map((score) => ({
      id: score.id,
      studentId: score.studentId,
      skillId: score.skillId,
      skillName: score.skill.name,
      apparatusName: score.skill.apparatus_name || 'Unknown',
      level: score.level,
      score: score.score,
      remark: score.remark,
      eventDate: score.eventdate,
      color: score.skill.color ?? null,
    }));

    return NextResponse.json(
      jsonBigInt({
        data: formattedResults,
        comments: assessmentComments,
        total: formattedResults.length,
        studentHeight: studentEventFee?.height ?? null,
        studentWeight: studentEventFee?.weight ?? null,
        eventName: event?.name ?? null,
        levelName: levelName ?? null,
      }),
    );
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}