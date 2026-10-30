import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific skill by ID
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

    // Only admins can access this endpoint (owners use /api/owner/skills/[id])
    if (!tenantContext.isAdmin) {
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
    });

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

// PUT: Update a specific skill
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

    // Only admins can access this endpoint (owners use /api/owner/skills/[id])
    if (!tenantContext.isAdmin) {
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
    // Admin doesn't send tenantId - it's set automatically from context

    // Check if skill exists
    const existingSkill = await prisma.skill.findUnique({
      where: { id },
    });

    if (!existingSkill) {
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
    
    // For admin, ensure tenant_id is set from context (don't allow changing it)
    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Admin must be associated with an academy' },
        { status: 400 },
      );
    }
    // Only update if the skill doesn't already have a tenant_id or if we're ensuring it's set
    const existingTenantId = (existingSkill as any).tenant_id;
    if (existingTenantId === null || existingTenantId !== tenantContext.tenantId) {
      updateData.tenant_id = tenantContext.tenantId;
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

// DELETE: Delete a specific skill
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

    // Only admins can access this endpoint (owners use /api/owner/skills/[id])
    if (!tenantContext.isAdmin) {
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
      include: { _count: { select: { assessmentScores: true } } },
    });

    if (!existingSkill || existingSkill.deletedAt) {
      return NextResponse.json(
        { message: 'Skill not found' },
        { status: 404 },
      );
    }

    if (existingSkill._count.assessmentScores > 0) {
      return NextResponse.json(
        { message: 'Cannot delete skill that has been assessed' },
        { status: 400 },
      );
    }

    // Soft delete
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

