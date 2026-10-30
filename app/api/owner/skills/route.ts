import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch all skills (owner only)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdat';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const status = searchParams.get('status');
  const apparatusId = searchParams.get('apparatusId');
  const gender = searchParams.get('gender');
  const tenantId = searchParams.get('tenantId');
  const skip = (page - 1) * limit;

  try {
    // Get tenant context for authentication
    const tenantContext = await getTenantContext(request as NextRequest);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {
      AND: [
        {
          OR: [
            {
              name: {
                contains: query,
              },
            },
            {
              apparatus_name: {
                contains: query,
              },
            },
          ],
        },
        {
          deletedAt: null, // Only show non-deleted skills
        },
      ],
    };

    if (status) {
      whereClause.status = status;
    }

    if (apparatusId) {
      whereClause.apparatus_id = parseInt(apparatusId);
    }

    if (gender) {
      whereClause.gender = gender;
    }

    // Owner can filter by specific academy
    if (tenantId) {
      const parsedTenantId = parseInt(tenantId);
      if (!isNaN(parsedTenantId)) {
        whereClause.tenant_id = parsedTenantId;
      }
    }

    // Count total records matching the filter
    const total = await prisma.skill.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.skill.count();
      isTableEmpty = overallTotal === 0;
    }

    const skills =
      total > 0
        ? await prisma.skill.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  academyName: true,
                  academyCode: true,
                },
              },
            },
          } as any)
        : [];

    return NextResponse.json({
      data: skills,
      pagination: {
        total,
        page,
      },
      empty: isTableEmpty,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new skill (owner only)
export async function POST(request: NextRequest) {
  try {
    // Get tenant context for authentication
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const apparatusId = typeof body?.apparatusId === 'number' ? body.apparatusId : null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const gender = typeof body?.gender === 'string' ? body.gender.trim() : '';
    const color = typeof body?.color === 'string' ? body.color.trim() : null;
    const level = typeof body?.level === 'string' ? body.level.trim() : null;
    const status = typeof body?.status === 'string' ? body.status.trim() : 'active';
    const tenantId = typeof body?.tenantId === 'number' ? body.tenantId : null;

    // For owner, tenantId is required
    if (!tenantId || tenantId <= 0) {
      return NextResponse.json(
        { message: 'Academy is required' },
        { status: 400 },
      );
    }

    if (!apparatusId || apparatusId <= 0) {
      return NextResponse.json(
        { message: 'Invalid apparatusId' },
        { status: 400 },
      );
    }

    if (!name || name.length > 200) {
      return NextResponse.json(
        { message: 'Invalid skill name' },
        { status: 400 },
      );
    }

    if (!gender || !['Male', 'Female', 'Mixed'].includes(gender)) {
      return NextResponse.json(
        { message: 'Invalid gender. Must be Male, Female, or Mixed' },
        { status: 400 },
      );
    }

    if (color && color.length > 10) {
      return NextResponse.json(
        { message: 'Invalid color. Maximum length is 10 characters' },
        { status: 400 },
      );
    }

    if (level && level.length > 10) {
      return NextResponse.json(
        { message: 'Invalid level. Maximum length is 10 characters' },
        { status: 400 },
      );
    }

    if (status && !['active', 'inactive'].includes(status.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid status. Must be active or inactive' },
        { status: 400 },
      );
    }

    // Verify apparatus exists and get its name
    const apparatus = await prisma.apparatus.findUnique({
      where: { id: apparatusId },
    });

    if (!apparatus) {
      return NextResponse.json(
        { message: 'Apparatus not found' },
        { status: 400 },
      );
    }

    // Use shortName if available, otherwise use name, truncated to 20 chars to match schema
    const apparatusName = apparatus.shortName || apparatus.name;
    const truncatedApparatusName = apparatusName.substring(0, 20);

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { message: 'Academy not found' },
        { status: 400 },
      );
    }

    // Create skill with tenant_id
    const skillData: any = {
      apparatus_id: apparatusId,
      apparatus_name: truncatedApparatusName,
      name,
      gender,
      color,
      level,
      status: status.toLowerCase(),
      tenant_id: tenantId,
      createdby: tenantContext.user.id,
    };

    const newSkill = await prisma.skill.create({
      data: skillData,
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newSkill.id),
      entityType: 'skill',
      description: 'Skill added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newSkill);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

