import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { jsonBigInt, getErrorMessage } from '@/types/api';
import { fetchFitnessResultsStudentEvent } from '@/lib/fitness-result-raw';

// GET: Fetch fitness assessment results for a student + event
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const eventId = searchParams.get('eventId');

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

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'Student ID and Event ID are required' },
        { status: 400 },
      );
    }

    const sid = parseInt(studentId, 10);
    const eid = parseInt(eventId, 10);
    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 403 });
    }

    const studentEventFee = await prisma.studentEventFee
      .findFirst({
        where: {
          studentId: BigInt(sid),
          eventid: eid,
          event: { tenantId },
        },
      })
      .then((fee) =>
        fee
          ? {
              height: (fee as { height?: number | null }).height ?? null,
              weight: (fee as { weight?: number | null }).weight ?? null,
            }
          : null,
      );

    const event = await prisma.event.findFirst({
      where: { id: eid, tenantId },
      select: { name: true },
    });

    const assessmentComments = await prisma.assessmentComment.findMany({
      where: {
        studentId: sid,
        eventid: eid,
        tenantId,
      },
      orderBy: { commentdate: 'desc' },
    });

    const assessmentRows = await fetchFitnessResultsStudentEvent(
      prisma,
      BigInt(sid),
      eid,
      tenantId,
    );

    const skillIds = Array.from(
      new Set(assessmentRows.map((r) => r.fitness_skill_id)),
    );
    const gradingRows =
      skillIds.length > 0
        ? await prisma.fitnessGradingCriteria.findMany({
            where: { fitnessSkillId: { in: skillIds } },
            orderBy: [{ level: 'asc' }, { id: 'asc' }],
            select: {
              fitnessSkillId: true,
              level: true,
              targetValue: true,
              description: true,
            },
          })
        : [];

    const targetLinesBySkill = new Map<number, string[]>();
    for (const g of gradingRows) {
      let line = '';
      if (g.targetValue && String(g.targetValue).trim()) {
        line = g.level
          ? `${g.level}: ${String(g.targetValue).trim()}`
          : String(g.targetValue).trim();
      } else if (g.description && String(g.description).trim()) {
        line = g.level
          ? `${g.level}: ${String(g.description).trim()}`
          : String(g.description).trim();
      }
      if (!line) continue;
      const arr = targetLinesBySkill.get(g.fitnessSkillId) ?? [];
      arr.push(line);
      targetLinesBySkill.set(g.fitnessSkillId, arr);
    }
    const targetBySkillId = new Map<number, string | null>();
    targetLinesBySkill.forEach((lines, skillId) => {
      targetBySkillId.set(skillId, lines.join('; '));
    });

    const formattedResults = assessmentRows.map((row) => {
      const category = row.category_name ?? row.level;
      return {
        id: row.id,
        studentId: Number(row.gymnast_id),
        fitnessSkillId: row.fitness_skill_id,
        skillName: row.skill_name,
        category,
        level: category,
        unitOfMeasurement: row.unit_of_measurement ?? null,
        targetValue: targetBySkillId.get(row.fitness_skill_id) ?? null,
        score: 0,
        achievedValue: row.achieved_value,
        remark: row.remarks,
        eventDate: row.date,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        data: formattedResults,
        comments: assessmentComments,
        total: formattedResults.length,
        studentHeight: studentEventFee?.height ?? null,
        studentWeight: studentEventFee?.weight ?? null,
        eventName: event?.name ?? null,
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
