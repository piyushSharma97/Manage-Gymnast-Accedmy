import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIP } from '@/lib/api';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete events
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

    // Check if user has permission to delete events
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Ensure tenantId is available
    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 400 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const eventIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (eventIds.length === 0) {
      return NextResponse.json(
        { message: 'No event IDs provided' },
        { status: 400 },
      );
    }

    // Validate all IDs are numbers
    const validIds = eventIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== eventIds.length) {
      return NextResponse.json(
        { message: 'Invalid event IDs provided' },
        { status: 400 },
      );
    }

    // Build where clause with tenant and location restrictions
    const whereClause: any = {
      id: { in: validIds },
      tenantId: tenantContext.tenantId,
    };

    // Managers can only delete events from their location
    if (tenantContext.isManager && tenantContext.locationId) {
      whereClause.locationId = tenantContext.locationId;
    }

    // Check if all events exist and belong to tenant
    const events = await prisma.event.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        locationId: true,
      },
    });

    if (events.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some events not found or access denied' },
        { status: 404 },
      );
    }

    // Delete events
    const deleteResult = await prisma.event.deleteMany({
      where: whereClause,
    });

    // Log the action for each deleted event
    for (const event of events) {
      await systemLog({
        event: 'DELETE_EVENT_BULK',
        userId: tenantContext.user?.id || '',
        entityId: event.id,
        entityType: 'EVENT',
        description: `Bulk deleted event: ${event.name}`,
        ipAddress: clientIp,
        meta: JSON.stringify({
          eventName: event.name,
          locationId: event.locationId,
          bulkDelete: true,
        }),
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} event(s) deleted successfully`,
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

