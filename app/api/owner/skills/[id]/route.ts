import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific skill by ID (owner only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
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

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill ID' },
        { status: 400 },
      );
    }

    const skill = await prisma.skill.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            academyName: true,
            academyCode: true,
          },
        },
      },
    } as any);

    if (!skill || skill.deletedAt) {
      return NextResponse.json(
        { message: 'Skill not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(skill);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific skill (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
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
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const apparatusId = typeof body?.apparatusId === 'number' ? body.apparatusId : null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const gender = typeof body?.gender === 'string' ? body.gender.trim() : '';
    const color = typeof body?.color === 'string' ? body.color.trim() : null;
    const level = typeof body?.level === 'string' ? body.level.trim() : null;
    const status = typeof body?.status === 'string' ? body.status.trim() : null;
    const tenantId = typeof body?.tenantId === 'number' ? body.tenantId : undefined;

    // Check if skill exists and is not already deleted
    const existingSkill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!existingSkill || existingSkill.deletedAt) {
      return NextResponse.json(
        { message: 'Skill not found' },
        { status: 404 },
      );
    }

    if (apparatusId && apparatusId <= 0) {
      return NextResponse.json(
        { message: 'Invalid apparatusId' },
        { status: 400 },
      );
    }

    if (name && name.length > 200) {
      return NextResponse.json(
        { message: 'Invalid skill name' },
        { status: 400 },
      );
    }

    if (gender && !['Male', 'Female', 'Mixed'].includes(gender)) {
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

    // If apparatusId is provided, verify apparatus exists and get its name
    let apparatusName = existingSkill.apparatus_name;
    if (apparatusId && apparatusId !== existingSkill.apparatus_id) {
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
      const apparatusNameFull = apparatus.shortName || apparatus.name;
      apparatusName = apparatusNameFull.substring(0, 20);
    }

    // If tenantId is provided, verify tenant exists
    if (tenantId !== undefined) {
      if (tenantId !== null && tenantId > 0) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });

        if (!tenant) {
          return NextResponse.json(
            { message: 'Academy not found' },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          { message: 'Academy is required' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (apparatusId !== null) {
      updateData.apparatus_id = apparatusId;
      updateData.apparatus_name = apparatusName;
    }
    if (name) updateData.name = name;
    if (gender) updateData.gender = gender;
    if (color !== undefined) updateData.color = color;
    if (level !== undefined) updateData.level = level;
    if (status !== null) updateData.status = status.toLowerCase();
    
    // Owner can update tenantId
    if (tenantId !== undefined) {
      updateData.tenant_id = tenantId;
    }

    const updatedSkill = await prisma.skill.update({
      where: { id },
      data: updateData,
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedSkill.id),
      entityType: 'skill',
      description: 'Skill updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedSkill);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific skill (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
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
      const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid skill ID' },
        { status: 400 },
      );
    }

    // Check if skill exists and is not already deleted
    const existingSkill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!existingSkill || existingSkill.deletedAt) {
      return NextResponse.json(
        { message: 'Skill not found' },
        { status: 404 },
      );
    }

    // Soft delete: set deletedAt instead of actually deleting
    await prisma.skill.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'skill',
      description: 'Skill deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Skill deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

