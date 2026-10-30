import { NextRequest, NextResponse } from 'next/server';
import { prisma, type PrismaClientWithFitnessSkill } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { insertFitnessResultRow } from '@/lib/fitness-result-raw';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// POST: Submit fitness assessment
export async function POST(request: NextRequest) {
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

    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { studentId, eventId, comments, skillRatings } = body;

    if (!studentId) {
      return NextResponse.json(
        { message: 'Student ID is required' },
        { status: 400 },
      );
    }

    const student = await prisma.student.findFirst({
      where: {
        id: BigInt(studentId),
        tenantId,
      },
    });
    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { message: 'Event ID is required' },
        { status: 400 },
      );
    }

    const event = await prisma.event.findFirst({
      where: {
        id: parseInt(String(eventId), 10),
        tenantId,
        event_type: 'fitness-assessment',
      },
    });
    if (!event) {
      return NextResponse.json(
        { message: 'Event not found or not a fitness-assessment event' },
        { status: 404 },
      );
    }

    const studentIdInt = parseInt(String(studentId), 10);
    const eventIdInt = parseInt(String(eventId), 10);
    if (isNaN(studentIdInt) || isNaN(eventIdInt)) {
      return NextResponse.json(
        { message: 'Invalid student ID or event ID' },
        { status: 400 },
      );
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      const db = tx as unknown as PrismaClientWithFitnessSkill;
      let commentId: number | null = null;
      if (comments && String(comments).trim()) {
        const comment = await tx.assessmentComment.create({
          data: {
            eventid: eventIdInt,
            tenantId,
            studentId: studentIdInt,
            commentdate: currentDate,
            comment: String(comments).trim().substring(0, 500),
          },
        });
        commentId = comment.id;
      }

      let scoresCount = 0;
      if (skillRatings && Array.isArray(skillRatings) && skillRatings.length > 0) {
        for (const entry of skillRatings) {
          if (!entry.fitnessSkillId) continue;
          const achievedValue =
            entry.achievedValue != null && String(entry.achievedValue).trim() !== ''
              ? String(entry.achievedValue).trim().substring(0, 200)
              : null;
          if (!achievedValue) continue;

          const skill = await db.fitnessSkill.findFirst({
            where: { id: entry.fitnessSkillId },
            include: { fitnessCategory: { select: { id: true, name: true } } },
          });
          if (!skill?.fitnessCategory) continue;

          await insertFitnessResultRow(tx, {
            gymnastId: BigInt(studentId),
            categoryName: skill.fitnessCategory.name,
            fitnessSkillId: entry.fitnessSkillId,
            fitnessCategoryId: skill.fitnessCategory.id,
            achievedValue,
            remarks:
              entry.remarks && String(entry.remarks).trim()
                ? String(entry.remarks).trim().substring(0, 200)
                : null,
            date: currentDate,
            eventId: eventIdInt,
            tenantId,
          });
          scoresCount += 1;
        }
      }

      return {
        commentId,
        scoresCount,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        message: 'Fitness assessment submitted successfully',
        commentId: result.commentId,
        scoresCount: result.scoresCount,
      }),
      { status: 201 },
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
