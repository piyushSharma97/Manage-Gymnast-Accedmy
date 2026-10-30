import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

// GET: Fetch events for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const eventType = searchParams.get('eventType'); // e.g. 'fitness-assessment' to only return fitness events

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view events
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
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

    // Create tenant-aware filters
    const tenantFilters = createTenantFilters(tenantContext);

    // Build where clause
    const whereClause: any = {
      tenantId: tenantContext.tenantId,
    };

    // Add location filter if provided
    if (locationId) {
      const locationIdNum = parseInt(locationId);
      if (!isNaN(locationIdNum)) {
        whereClause.locationId = locationIdNum;
      }
    }

    // Apply tenant filters (for managers, this adds locationId)
    if (tenantFilters.locationId) {
      whereClause.locationId = tenantFilters.locationId;
    }

    // Filter by event type when requested (e.g. fitness-assessment)
    if (eventType && String(eventType).trim()) {
      whereClause.event_type = String(eventType).trim();
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        event_type: true,
        startdate: true,
        enddate: true,
        fees: true,
        time: true,
        locationId: true,
      },
      orderBy: [
        { startdate: 'desc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(events);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

