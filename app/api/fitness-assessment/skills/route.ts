import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

const jsonBigInt = (obj: unknown) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch fitness skills grouped by category for assessment form (like skills assessment: apparatus → skills)
export async function GET(request: NextRequest) {
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

    const skills = await prisma.fitnessSkill.findMany({
      orderBy: [
        { fitnessCategory: { name: 'asc' } },
        { name: 'asc' },
      ],
      include: {
        fitnessCategory: { select: { id: true, name: true } },
        gradingCriteria: {
          orderBy: { level: 'asc' },
          select: { id: true, level: true, description: true, targetValue: true },
        },
      },
    });

    // Group by category (same shape as before: id, name, shortName, level → category id/name, skills with unit + gradingCriteria)
    const byCategory = skills.reduce<
      Record<
        number,
        {
          id: string;
          name: string;
          shortName: string;
          level: string;
          skills: Array<{
            id: number;
            name: string;
            level: string;
            description: string | null;
            orderSequence: number;
            unitOfMeasurement: string;
            gradingCriteria: Array<{ id: number; level: string; description: string | null; targetValue: string | null }>;
          }>;
        }
      >
    >((acc, s) => {
      const cat = s.fitnessCategory;
      if (!cat) return acc;
      const key = cat.id;
      if (!acc[key]) {
        acc[key] = {
          id: String(key),
          name: cat.name,
          shortName: cat.name,
          level: cat.name,
          skills: [],
        };
      }
      acc[key].skills.push({
        id: s.id,
        name: s.name,
        level: cat.name,
        description: null,
        orderSequence: 0,
        unitOfMeasurement: s.unitOfMeasurement,
        gradingCriteria: s.gradingCriteria.map((g) => ({
          id: g.id,
          level: g.level,
          description: g.description,
          targetValue: g.targetValue,
        })),
      });
      return acc;
    }, {});

    const result = Object.values(byCategory);

    return NextResponse.json(
      jsonBigInt({
        data: result,
      }),
    );
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) || 'Unexpected error' },
      { status: 500 },
    );
  }
}
