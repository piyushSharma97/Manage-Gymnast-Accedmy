import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete skills
export async function DELETE(request: NextRequest) {
  try {
    // Get tenant context for authentication
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Only admins can access this endpoint (owners use /api/owner/skills/delete)
    if (!tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const skillIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (skillIds.length === 0) {
      return NextResponse.json(
        { message: 'No skill IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = skillIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== skillIds.length) {
      return NextResponse.json(
        { message: 'Invalid skill IDs provided' },
        { status: 400 },
      );
    }

    // Get skill details for logging
    const skillsToDelete = await prisma.skill.findMany({
      where: { 
        id: { in: validIds },
      },
      select: {
        id: true,
        name: true,
        apparatus_name: true,
      },
    });

    if (skillsToDelete.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some skills not found' },
        { status: 400 },
      );
    }

    // Delete the skills
    const deleteResult = await prisma.skill.deleteMany({
      where: { 
        id: { in: validIds },
      },
    });

    // Log the deletion
    for (const skill of skillsToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(skill.id),
        entityType: 'skill',
        description: `Skill deleted: ${skill.name} (${skill.apparatus_name})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} skill(s) deleted successfully`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

