import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext, validateResourceAccess } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific skill level by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill level ID' },
        { status: 400 },
      );
    }

    const skillLevel = await prisma.skillLevel.findUnique({
      where: { id },
      include: {
        sportsCategory: {
          select: {
            id: true,
            categoryName: true,
          },
        },
      },
    });

    if (!skillLevel) {
      return NextResponse.json(
        { message: 'Skill level not found' },
        { status: 404 },
      );
    }

    // Check if user has access to this skill level
    if (!validateResourceAccess(tenantContext, skillLevel.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    return NextResponse.json(skillLevel);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific skill level
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam, 10);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill level ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const sportsId = typeof body?.sportsId === 'number' ? body.sportsId : null;
    const levelName = typeof body?.levelName === 'string' ? body.levelName.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;

    // Check if skill level exists
    const existingSkillLevel = await prisma.skillLevel.findUnique({
      where: { id },
    });

    if (!existingSkillLevel) {
      return NextResponse.json(
        { message: 'Skill level not found' },
        { status: 404 },
      );
    }

    // Check if user has access to this skill level
    if (!validateResourceAccess(tenantContext, existingSkillLevel.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    if (sportsId && sportsId <= 0) {
      return NextResponse.json(
        { message: 'Invalid sportsId' },
        { status: 400 },
      );
    }

    if (levelName && levelName.length > 50) {
      return NextResponse.json(
        { message: 'Invalid levelName' },
        { status: 400 },
      );
    }

    // If sportsId is provided, verify sports category exists
    if (sportsId) {
      const sportsCategory = await prisma.sportsCategory.findUnique({
        where: { id: sportsId },
      });

      if (!sportsCategory) {
        return NextResponse.json(
          { message: 'Sports category not found' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for level name if provided and different from current
    if (levelName && levelName !== existingSkillLevel.levelName) {
      const finalSportsId = sportsId || existingSkillLevel.sportsId;
      const existingName = await prisma.skillLevel.findFirst({
        where: {
          levelName,
          sportsId: finalSportsId,
          tenantId: existingSkillLevel.tenantId,
          id: { not: id },
        },
      });
      if (existingName) {
        return NextResponse.json(
          { message: 'Level name must be unique within the sport' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (sportsId !== null) updateData.sportsId = sportsId;
    if (levelName) {
      updateData.levelName = levelName;
      updateData.levelCode = levelName;
    }
    if (description !== undefined) updateData.description = description;
    updateData.updatedBy = tenantContext.user.id;

    const updatedSkillLevel = await prisma.skillLevel.update({
      where: { id },
      data: updateData,
      include: {
        sportsCategory: {
          select: {
            id: true,
            categoryName: true,
          },
        },
      },
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedSkillLevel.id),
      entityType: 'skill.level',
      description: 'Skill level updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedSkillLevel);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific skill level
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam, 10);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill level ID' },
        { status: 400 },
      );
    }

    // Check if skill level exists
    const existingSkillLevel = await prisma.skillLevel.findUnique({
      where: { id },
    });

    if (!existingSkillLevel) {
      return NextResponse.json(
        { message: 'Skill level not found' },
        { status: 404 },
      );
    }

    // Check if user has access to this skill level
    if (!validateResourceAccess(tenantContext, existingSkillLevel.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    // Check if skill level is being used by students (filtered by tenant)
    const studentsCount = await prisma.student.count({
      where: { 
        skilllevelName: existingSkillLevel.levelName,
        tenantId: existingSkillLevel.tenantId,
      },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete skill level that is assigned to students' },
        { status: 400 },
      );
    }

    await prisma.skillLevel.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'skill.level',
      description: 'Skill level deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Skill level deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
