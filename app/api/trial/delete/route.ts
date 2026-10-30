import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete trials
export async function DELETE(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const trialIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (trialIds.length === 0) {
      return NextResponse.json(
        { message: 'No trial IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = trialIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== trialIds.length) {
      return NextResponse.json(
        { message: 'Invalid trial IDs provided' },
        { status: 400 },
      );
    }

    // Get trial details for logging (only for trials belonging to the tenant)
    const trialsToDelete = await prisma.trial.findMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        participantName: true,
        parentName: true,
      },
    });

    if (trialsToDelete.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some trials not found or access denied' },
        { status: 400 },
      );
    }

    // Delete the trials
    const deleteResult = await prisma.trial.deleteMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
    });

    // Log the deletion
    for (const trial of trialsToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(trial.id),
        entityType: 'trial',
        description: `Trial deleted: ${trial.participantName}${trial.parentName ? ` (Parent: ${trial.parentName})` : ''}`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} trial(s) deleted successfully`,
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
