import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getErrorMessage } from '@/types/api';
import type { Prisma } from '@prisma/client';

// GET: Fetch all skill levels
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const sportsId = searchParams.get('sportsId');
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    // Filter by tenantId (unless owner)
    const andConditions: Prisma.SkillLevelWhereInput[] = [
      {
        OR: [
          {
            levelName: {
              contains: query,
            },
          },
          {
            levelCode: {
              contains: query,
            },
          },
        ],
      },
    ];

    // Add tenant filter (owners can see all, others see only their tenant)
    if (tenantContext.tenantId && !tenantContext.isOwner) {
      andConditions.push({ tenantId: tenantContext.tenantId });
    }

    if (isActive === 'true' || isActive === 'false') {
      andConditions.push({ isActive: isActive === 'true' });
    }

    if (sportsId) {
      andConditions.push({ sportsId: parseInt(sportsId) });
    }

    const whereClause: Prisma.SkillLevelWhereInput = { AND: andConditions };

    // Count total records matching the filter
    const total = await prisma.skillLevel.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.skillLevel.count();
      isTableEmpty = overallTotal === 0;
    }

    const skillLevels =
      total > 0
        ? await prisma.skillLevel.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
            include: {
              sportsCategory: {
                select: {
                  id: true,
                  categoryName: true,
                },
              },
            },
          })
        : [];

    return NextResponse.json({
      data: skillLevels,
      pagination: {
        total,
        page,
      },
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

// POST: Add a new skill level
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Tenant ID is required' },
        { status: 400 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const sportsId = typeof body?.sportsId === 'number' ? body.sportsId : null;
    const levelName = typeof body?.levelName === 'string' ? body.levelName.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;

    if (!sportsId || sportsId <= 0) {
      return NextResponse.json(
        { message: 'Invalid sportsId' },
        { status: 400 },
      );
    }

    if (!levelName || levelName.length > 50) {
      return NextResponse.json(
        { message: 'Invalid levelName' },
        { status: 400 },
      );
    }

    // Verify sports category exists
    const sportsCategory = await prisma.sportsCategory.findUnique({
      where: { id: sportsId },
    });

    if (!sportsCategory) {
      return NextResponse.json(
        { message: 'Sports category not found' },
        { status: 400 },
      );
    }

    // Ensure the level name is unique within the sport and tenant
    const existingName = await prisma.skillLevel.findFirst({
      where: {
        levelName,
        sportsId,
        tenantId: tenantContext.tenantId,
      },
    });
    if (existingName) {
      return NextResponse.json(
        { message: 'Level name must be unique within the sport' },
        { status: 400 },
      );
    }

    const trimmedLevelName = levelName;
    const derivedLevelCode = trimmedLevelName;

    // Ensure the level code (same as name) is unique within the sport and tenant
    const existingCode = await prisma.skillLevel.findFirst({
      where: {
        levelCode: derivedLevelCode,
        sportsId,
        tenantId: tenantContext.tenantId,
      },
    });
    if (existingCode) {
      return NextResponse.json(
        { message: 'Level name must be unique within the sport' },
        { status: 400 },
      );
    }

    const newSkillLevel = await prisma.skillLevel.create({
      data: {
        sportsId,
        tenantId: tenantContext.tenantId,
        levelName: trimmedLevelName,
        levelCode: derivedLevelCode,
        description,
        orderSequence: 1,
        isActive: true,
        createdBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newSkillLevel.id),
      entityType: 'skill.level',
      description: 'Skill level added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newSkillLevel);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
