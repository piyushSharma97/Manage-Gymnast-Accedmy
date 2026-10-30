import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIP } from '@/lib/api';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { isExternalEventType } from '@/lib/event-external';
import { parseNonNegativeFee, parseOptionalNonNegativeFee } from '@/lib/event-fee-validation';

// GET: Fetch a specific event by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
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

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid event ID' },
        { status: 400 },
      );
    }

    const event = await prisma.event.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
        // Managers can only access their location's events
        ...(tenantContext.isManager && tenantContext.locationId
          ? { locationId: tenantContext.locationId }
          : {}),
      },
    });

    if (!event) {
      return NextResponse.json(
        { message: 'Event not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(event);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to update events
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

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid event ID' },
        { status: 400 },
      );
    }

    // Check if event exists and belongs to tenant
    const existingEvent = await prisma.event.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
        // Managers can only access their location's events
        ...(tenantContext.isManager && tenantContext.locationId
          ? { locationId: tenantContext.locationId }
          : {}),
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { message: 'Event not found' },
        { status: 404 },
      );
    }

    // Extract and validate fields
    const name = typeof body?.name === 'string' ? body.name.trim() : existingEvent.name;
    const description = typeof body?.description === 'string' ? body.description.trim() : existingEvent.description;
    const event_type = typeof body?.event_type === 'string' ? body.event_type.trim() : existingEvent.event_type;
    const startdate = body?.startdate ? new Date(body.startdate) : existingEvent.startdate;
    const enddate = body?.enddate ? new Date(body.enddate) : existingEvent.enddate;
    const feesParsed =
      typeof body?.fees !== 'undefined'
        ? parseNonNegativeFee(body.fees)
        : { ok: true as const, value: existingEvent.fees };
    if (!feesParsed.ok) {
      return NextResponse.json({ message: feesParsed.message }, { status: 400 });
    }
    const feesValue = feesParsed.value;

    let earlybird: number | null;
    if (typeof body?.earlybird !== 'undefined') {
      if (body.earlybird === null) {
        earlybird = null;
      } else {
        const eb = parseOptionalNonNegativeFee(body.earlybird);
        if (!eb.ok) {
          return NextResponse.json({ message: eb.message }, { status: 400 });
        }
        earlybird = eb.value;
      }
    } else {
      earlybird = existingEvent.earlybird;
    }
    const early_date = body?.early_date ? new Date(body.early_date) : body?.early_date === null ? null : existingEvent.early_date;
    const regstart_date = body?.regstart_date ? new Date(body.regstart_date) : body?.regstart_date === null ? null : existingEvent.regstart_date;
    const regend = body?.regend ? new Date(body.regend) : body?.regend === null ? null : existingEvent.regend;
    const time = typeof body?.time === 'string' ? body.time.trim() : body?.time === null ? null : existingEvent.time;
    const locationId = typeof body?.locationId !== 'undefined'
      ? (typeof body.locationId === 'number' ? body.locationId : parseInt(body.locationId))
      : existingEvent.locationId;

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

    // Validate locationId
    if (!locationId || locationId <= 0) {
      return NextResponse.json(
        { message: 'Valid locationId is required' },
        { status: 400 },
      );
    }

    // Check if location exists and belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: locationId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found or access denied' },
        { status: 404 },
      );
    }

    // Validate manager can only update events for their location
    if (tenantContext.isManager && tenantContext.locationId && locationId !== tenantContext.locationId) {
      return NextResponse.json(
        { message: 'Insufficient permissions. You can only update events for your location.' },
        { status: 403 },
      );
    }

    const externalType = isExternalEventType(event_type);
    // Update event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        name,
        description,
        event_type: event_type || null,
        startdate,
        enddate,
        fees: feesValue,
        earlybird: externalType ? null : earlybird || null,
        early_date: externalType ? null : early_date || null,
        regstart_date: regstart_date || null,
        regend: regend || null,
        time: time || null,
        locationId: locationId,
        updatedBy: tenantContext.user?.id || '',
      },
    });

    // Log the action
    await systemLog({
      event: 'UPDATE_EVENT',
      userId: tenantContext.user?.id || '',
      entityId: updatedEvent.id,
      entityType: 'EVENT',
      description: `Updated event: ${name}`,
      ipAddress: clientIp,
      meta: JSON.stringify({
        eventName: name,
        locationId: locationId,
        startdate: startdate.toISOString(),
        enddate: enddate.toISOString(),
      }),
    });

    return NextResponse.json(updatedEvent);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
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
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid event ID' },
        { status: 400 },
      );
    }

    // Check if event exists and belongs to tenant
    const existingEvent = await prisma.event.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
        // Managers can only access their location's events
        ...(tenantContext.isManager && tenantContext.locationId
          ? { locationId: tenantContext.locationId }
          : {}),
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { message: 'Event not found' },
        { status: 404 },
      );
    }

    // Delete event
    await prisma.event.delete({
      where: { id },
    });

    // Log the action
    await systemLog({
      event: 'DELETE_EVENT',
      userId: tenantContext.user?.id || '',
      entityId: id,
      entityType: 'EVENT',
      description: `Deleted event: ${existingEvent.name}`,
      ipAddress: clientIp,
      meta: JSON.stringify({
        eventName: existingEvent.name,
        locationId: existingEvent.locationId,
      }),
    });

    return NextResponse.json({ message: 'Event deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

