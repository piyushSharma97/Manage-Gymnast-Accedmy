import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch grading criteria with pagination and filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const sortField = searchParams.get('sort') || 'level';
  const sortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const query = searchParams.get('query') || '';
  const fitnessSkillId = searchParams.get('fitnessSkillId');
  const categoryId = searchParams.get('categoryId');
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const andConditions: Record<string, unknown>[] = [];

    if (fitnessSkillId) {
      const skillId = parseInt(fitnessSkillId, 10);
      if (!Number.isNaN(skillId)) andConditions.push({ fitnessSkillId: skillId });
    }
    if (categoryId) {
      const catId = parseInt(categoryId, 10);
      if (!Number.isNaN(catId)) {
        andConditions.push({
          fitnessSkill: { fitnessCategoryId: catId },
        });
      }
    }
    if (query.trim()) {
      andConditions.push({
        OR: [
          { level: { contains: query } },
          { description: { contains: query } },
          { targetValue: { contains: query } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const total = await prisma.fitnessGradingCriteria.count({ where });

    const validSortFields = ['level', 'targetValue', 'description', 'id'];
    const orderField = validSortFields.includes(sortField) ? sortField : 'level';

    const data =
      total > 0
        ? await prisma.fitnessGradingCriteria.findMany({
            skip,
            take: limit,
            where,
            orderBy: [{ [orderField]: sortDir }, { id: 'asc' }],
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
          })
        : [];

    return NextResponse.json({
      data,
      pagination: { total, page },
      empty: total === 0,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new grading criterion
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const fitnessSkillId = typeof body?.fitnessSkillId === 'number' ? body.fitnessSkillId : undefined;
    const level = typeof body?.level === 'string' ? body.level.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const targetValue = typeof body?.targetValue === 'string' ? body.targetValue.trim() : null;

    if (fitnessSkillId == null || fitnessSkillId < 1) {
      return NextResponse.json(
        { message: 'Valid fitnessSkillId is required' },
        { status: 400 },
      );
    }
    if (!level || level.length > 200) {
      return NextResponse.json(
        { message: 'Level is required and must be 200 characters or less' },
        { status: 400 },
      );
    }

    const skill = await prisma.fitnessSkill.findUnique({
      where: { id: fitnessSkillId },
    });
    if (!skill) {
      return NextResponse.json({ message: 'Fitness skill not found' }, { status: 404 });
    }

    const existing = await prisma.fitnessGradingCriteria.findFirst({
      where: { fitnessSkillId, level },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'A criterion with this level already exists for this skill' },
        { status: 400 },
      );
    }

    const created = await prisma.fitnessGradingCriteria.create({
      data: {
        fitnessSkillId,
        level,
        description,
        targetValue,
        createdBy: tenantContext.user.id,
        updatedBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(created.id),
      entityType: 'fitness.gradingCriteria',
      description: 'Fitness grading criterion added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
