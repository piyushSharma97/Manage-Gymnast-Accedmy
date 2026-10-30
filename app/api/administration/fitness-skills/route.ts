import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch all fitness skills (with category)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const categoryId = searchParams.get('categoryId');
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    // Only include skills that have a valid category (avoids null fitnessCategory when FK is orphaned)
    const categoryIds = await prisma.fitnessCategory.findMany({ select: { id: true } }).then((r) => r.map((c) => c.id));
    const andConditions: Record<string, unknown>[] = [];
    if (categoryIds.length > 0) {
      andConditions.push({ fitnessCategoryId: { in: categoryIds } });
    }
    if (query) {
      andConditions.push({
        OR: [
          { name: { contains: query } },
          { unitOfMeasurement: { contains: query } },
        ],
      });
    }
    if (categoryId) {
      const catId = parseInt(categoryId, 10);
      if (!Number.isNaN(catId)) {
        andConditions.push({ fitnessCategoryId: catId });
      }
    }
    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    const total = await prisma.fitnessSkill.count({ where: whereClause });
    let isTableEmpty = total === 0;
    if (total === 0) {
      const overallTotal = await prisma.fitnessSkill.count();
      isTableEmpty = overallTotal === 0;
    }

    const fitnessSkills =
      total > 0
        ? await prisma.fitnessSkill.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: { [sortField]: sortDirection },
            include: {
              fitnessCategory: { select: { id: true, name: true } },
            },
          })
        : [];

    return NextResponse.json({
      data: fitnessSkills,
      pagination: { total, page },
      empty: isTableEmpty,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new fitness skill
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const fitnessCategoryId = typeof body?.fitnessCategoryId === 'number' ? body.fitnessCategoryId : undefined;
    const unitOfMeasurement = typeof body?.unitOfMeasurement === 'string' ? body.unitOfMeasurement.trim() : '';

    if (!name || name.length > 200) {
      return NextResponse.json(
        { message: 'Skill name is required and must be 200 characters or less' },
        { status: 400 },
      );
    }
    if (fitnessCategoryId == null || fitnessCategoryId < 1) {
      return NextResponse.json(
        { message: 'A fitness category is required' },
        { status: 400 },
      );
    }
    if (!unitOfMeasurement || unitOfMeasurement.length > 190) {
      return NextResponse.json(
        { message: 'Unit of measurement is required and must be 190 characters or less' },
        { status: 400 },
      );
    }

    const category = await prisma.fitnessCategory.findUnique({
      where: { id: fitnessCategoryId },
    });
    if (!category) {
      return NextResponse.json(
        { message: 'Fitness category not found' },
        { status: 404 },
      );
    }

    const existingSkill = await prisma.fitnessSkill.findFirst({
      where: { name, fitnessCategoryId },
    });
    if (existingSkill) {
      return NextResponse.json(
        { message: 'A skill with this name already exists in this category' },
        { status: 400 },
      );
    }

    const newSkill = await prisma.fitnessSkill.create({
      data: {
        name,
        fitnessCategoryId,
        unitOfMeasurement,
        createdBy: tenantContext.user.id,
        updatedBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newSkill.id),
      entityType: 'fitness.skill',
      description: 'Fitness skill added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newSkill);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
