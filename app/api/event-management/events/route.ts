import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getClientIP } from '@/lib/api';
import { systemLog } from '@/services/system-log';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';
import { isExternalEventType } from '@/lib/event-external';
import { parseNonNegativeFee, parseOptionalNonNegativeFee } from '@/lib/event-fee-validation';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const query = searchParams.get('query') || '';
  const locationId = searchParams.get('locationId');
  const sortField = searchParams.get('sort') || 'name';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(req);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
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
    
    // Build AND array for filters
    const andConditions: Prisma.EventWhereInput[] = [
      {
        tenantId: tenantContext.tenantId,
      },
    ];

    // Add search query if provided
    if (query) {
      andConditions.push({
        OR: [
          { name: { contains: query } },
          { description: { contains: query } },
          { event_type: { contains: query } },
        ],
      });
    }

    // Add location filter if provided
    if (locationId) {
      const locationIdNum = parseInt(locationId);
      if (!isNaN(locationIdNum)) {
        andConditions.push({ locationId: locationIdNum });
      }
    }

    // Apply tenant filters (for managers, this adds locationId)
    if (tenantFilters.locationId) {
      andConditions.push({ locationId: tenantFilters.locationId });
    }

    const filters: Prisma.EventWhereInput = {
      AND: andConditions,
    };

    const totalCount = await prisma.event.count({ where: filters });

    const sortMap: Record<string, Prisma.EventOrderByWithRelationInput> = {
      name: { name: sortDirection },
      startdate: { startdate: sortDirection },
      enddate: { enddate: sortDirection },
      createdAt: { createdAt: sortDirection },
    };

    const orderBy = sortMap[sortField] || { createdAt: sortDirection };

    const events = await prisma.event.findMany({
      where: filters,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
    });

    return NextResponse.json({
      data: events,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// POST: Create a new event
export async function POST(req: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(req);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create events
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

    const clientIp = getClientIP(req);
    const body = await req.json();

    // Extract and validate required fields
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const event_type = typeof body?.event_type === 'string' ? body.event_type.trim() : null;
    const startdate = body?.startdate ? new Date(body.startdate) : null;
    const enddate = body?.enddate ? new Date(body.enddate) : null;
    const feesResult = parseNonNegativeFee(body?.fees);
    if (!feesResult.ok) {
      return NextResponse.json({ message: feesResult.message }, { status: 400 });
    }
    const fees = feesResult.value;

    const earlyResult = parseOptionalNonNegativeFee(body?.earlybird);
    if (!earlyResult.ok) {
      return NextResponse.json({ message: earlyResult.message }, { status: 400 });
    }
    let earlybird = earlyResult.value;
    const early_date = body?.early_date ? new Date(body.early_date) : null;
    const regstart_date = body?.regstart_date ? new Date(body.regstart_date) : null;
    const regend = body?.regend ? new Date(body.regend) : null;
    const time = typeof body?.time === 'string' ? body.time.trim() : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : typeof body?.locationId === 'string' ? parseInt(body.locationId) : null;

    // Validate required fields
    if (!name || name.length > 250) {
      return NextResponse.json(
        { message: 'Invalid name. Name is required and must be 250 characters or less.' },
        { status: 400 },
      );
    }

    if (!description) {
      return NextResponse.json(
        { message: 'Description is required' },
        { status: 400 },
      );
    }

    if (!startdate || isNaN(startdate.getTime())) {
      return NextResponse.json(
        { message: 'Valid start date is required' },
        { status: 400 },
      );
    }

    if (!enddate || isNaN(enddate.getTime())) {
      return NextResponse.json(
        { message: 'Valid end date is required' },
        { status: 400 },
      );
    }

    if (enddate < startdate) {
      return NextResponse.json(
        { message: 'End date must be after start date' },
        { status: 400 },
      );
    }

    // Use locationId from request or context
    const finalLocationId = locationId || tenantContext.locationId;

    if (!finalLocationId || finalLocationId <= 0) {
      return NextResponse.json(
        { message: 'Valid locationId is required' },
        { status: 400 },
      );
    }

    // Check if location exists and belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: finalLocationId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found or access denied' },
        { status: 404 },
      );
    }

    // Validate manager can only create events for their location
    if (tenantContext.isManager && tenantContext.locationId && finalLocationId !== tenantContext.locationId) {
      return NextResponse.json(
        { message: 'Insufficient permissions. You can only create events for your location.' },
        { status: 403 },
      );
    }

    const externalType = isExternalEventType(event_type);
    // Create event
    const event = await prisma.event.create({
      data: {
        name,
        description,
        event_type: event_type || null,
        startdate,
        enddate,
        fees,
        earlybird: externalType ? null : earlybird || null,
        early_date: externalType ? null : early_date || null,
        regstart_date: regstart_date || null,
        regend: regend || null,
        time: time || null,
        locationId: finalLocationId,
        tenantId: tenantContext.tenantId,
        createdBy: tenantContext.user?.id || null,
        updatedBy: tenantContext.user?.id || '',
      },
    });

    // Log the action
    await systemLog({
      event: 'CREATE_EVENT',
      userId: tenantContext.user?.id || '',
      entityId: event.id,
      entityType: 'EVENT',
      description: `Created event: ${name}`,
      ipAddress: clientIp,
      meta: JSON.stringify({
        eventName: name,
        locationId: finalLocationId,
        startdate: startdate.toISOString(),
        enddate: enddate.toISOString(),
      }),
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
