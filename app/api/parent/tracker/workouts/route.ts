import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/tracker/workouts?studentId=...
 * Read-only list of fitness workouts (grading criteria) configured by coaches/staff.
 * studentId is required only to verify parent–child access.
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

    const student = await prisma.student.findUnique({
      where: { id: studentIdBigInt },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const criteria = await prisma.fitnessGradingCriteria.findMany({
      orderBy: [
        { fitnessSkill: { fitnessCategory: { name: 'asc' } } },
        { fitnessSkill: { name: 'asc' } },
        { level: 'asc' },
        { id: 'asc' },
      ],
      include: {
        fitnessSkill: {
          select: {
            id: true,
            name: true,
            unitOfMeasurement: true,
            fitnessCategory: { select: { id: true, name: true } },
          },
        },
      },
    });

    const rawCoachIds = criteria
      .map((c) => c.createdBy)
      .filter((id): id is string => Boolean(id && id.length > 0));
    const coachIds = rawCoachIds.filter((id, index) => rawCoachIds.indexOf(id) === index);
    const coaches =
      coachIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: coachIds } },
            select: { id: true, name: true, lastName: true, email: true },
          })
        : [];
    const coachLabel = new Map<string, string>();
    for (const u of coaches) {
      const parts = [u.name, u.lastName].filter(Boolean).join(' ').trim();
      coachLabel.set(u.id, parts || u.email);
    }

    const workouts = criteria.map((c) => {
      const skill = c.fitnessSkill;
      const categoryName = skill.fitnessCategory?.name ?? 'Other';
      const createdById = c.createdBy ?? null;
      return {
        id: c.id,
        level: c.level,
        targetValue: c.targetValue,
        description: c.description,
        skillId: skill.id,
        skillName: skill.name,
        unitOfMeasurement: skill.unitOfMeasurement,
        categoryId: skill.fitnessCategory?.id ?? null,
        categoryName,
        addedByUserId: createdById,
        addedByName: createdById ? coachLabel.get(createdById) ?? null : null,
        updatedAt: c.updatedAt?.toISOString() ?? null,
      };
    });

    const categoryNames = workouts.map((w) => w.categoryName);
    const categories = categoryNames
      .filter((name, index) => categoryNames.indexOf(name) === index)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json(
      jsonBigInt({
        workouts,
        categories,
        total: workouts.length,
      }),
    );
  } catch (error) {
    console.error('[parent/tracker/workouts]', error);
    return NextResponse.json({ message: 'Failed to fetch workouts' }, { status: 500 });
  }
}
