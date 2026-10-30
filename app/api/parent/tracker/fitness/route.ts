import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/tracker/fitness?studentId=...
 * Returns fitness skills grouped by category for the parent to view curriculum.
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
      select: { tenantId: true },
    });
    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const fitnessSkills = await prisma.fitnessSkill.findMany({
      orderBy: [
        { fitnessCategory: { name: 'asc' } },
        { name: 'asc' },
      ],
      include: {
        fitnessCategory: { select: { id: true, name: true } },
      },
    });

    const byLevel = fitnessSkills.reduce<Record<string, typeof fitnessSkills>>((acc, s) => {
      const level = s.fitnessCategory?.name ?? 'Other';
      if (!acc[level]) acc[level] = [];
      acc[level].push(s);
      return acc;
    }, {});

    const data = {
      levels: Object.keys(byLevel).sort(),
      skillsByLevel: Object.fromEntries(
        Object.entries(byLevel).map(([k, v]) => [
          k,
          v.map((s) => ({
            id: s.id,
            name: s.name,
            level: s.fitnessCategory?.name ?? k,
            description: null,
            orderSequence: 0,
          })),
        ]),
      ),
      skills: fitnessSkills.map((s) => ({
        id: s.id,
        name: s.name,
        level: s.fitnessCategory?.name ?? '',
        description: null,
        orderSequence: 0,
      })),
    };

    return NextResponse.json(jsonBigInt(data));
  } catch (error) {
    console.error('[parent/tracker/fitness]', error);
    return NextResponse.json({ message: 'Failed to fetch fitness' }, { status: 500 });
  }
}
