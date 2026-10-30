import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch a specific trial by ID
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

    // Check if user has permission to view trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid trial ID' },
        { status: 400 },
      );
    }

    const trial = await prisma.trial.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
    });

    if (!trial) {
      return NextResponse.json(
        { message: 'Trial not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(jsonBigInt(trial));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific trial
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

    // Check if user has permission to update trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid trial ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const participantName = typeof body?.participantName === 'string' ? body.participantName.trim() : '';
    const parentName = typeof body?.parentName === 'string' ? body.parentName.trim() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const trialDate = typeof body?.trialDate === 'string' ? new Date(body.trialDate) : null;
    const trialTime = typeof body?.trialTime === 'string' ? body.trialTime.trim() : null;
    const gender = typeof body?.gender === 'string' ? body.gender : null;
    const isRegistered = typeof body?.isRegistered === 'boolean' ? body.isRegistered : null;
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
    const type = typeof body?.type === 'string' ? body.type.trim() : null;
    const age = typeof body?.age === 'number' ? body.age : null;
    const instructor = typeof body?.instructor === 'string' ? body.instructor.trim() : null;
    const other = typeof body?.other === 'string' ? body.other.trim() : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    // Check if trial exists and belongs to tenant
    const existingTrial = await prisma.trial.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingTrial) {
      return NextResponse.json(
        { message: 'Trial not found' },
        { status: 404 },
      );
    }

    if (participantName && participantName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid participantName' },
        { status: 400 },
      );
    }

    if (parentName && parentName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid parentName' },
        { status: 400 },
      );
    }

    if (phone && phone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid phone' },
        { status: 400 },
      );
    }

    if (trialDate && isNaN(trialDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid trialDate' },
        { status: 400 },
      );
    }

    if (trialTime && trialTime.length > 20) {
      return NextResponse.json(
        { message: 'Invalid trialTime' },
        { status: 400 },
      );
    }

    if (email && (email.length > 150 || !email.includes('@'))) {
      return NextResponse.json(
        { message: 'Invalid email' },
        { status: 400 },
      );
    }

    if (type && type.length > 50) {
      return NextResponse.json(
        { message: 'Invalid type' },
        { status: 400 },
      );
    }

    if (age && (age < 0 || age > 120)) {
      return NextResponse.json(
        { message: 'Invalid age' },
        { status: 400 },
      );
    }

    if (instructor && instructor.length > 100) {
      return NextResponse.json(
        { message: 'Invalid instructor' },
        { status: 400 },
      );
    }  
    if(locationId === null){
      return NextResponse.json(
        { message: 'Invalid location' },
        { status: 400 },
      );
    }

    if (gender && !['Male', 'Female', 'Mixed'].includes(gender)) {
      return NextResponse.json(
        { message: 'Invalid gender' },
        { status: 400 },
      );
    }

    const updateData: any = {};
    if (participantName) updateData.participantName = participantName;
    if (parentName !== undefined) updateData.parentName = parentName;
    if (locationId !== null) updateData.locationId = locationId;
    if (phone !== undefined) updateData.phone = phone;
    if (trialDate) updateData.trialDate = trialDate;
    if (trialTime) updateData.trialTime = trialTime;
    if (gender !== undefined) updateData.gender = gender;
    if (isRegistered !== null) updateData.isRegistered = isRegistered;
    if (email !== undefined) updateData.email = email;
    if (type !== undefined) updateData.type = type;
    if (age !== null) updateData.age = age;
    if (instructor !== undefined) updateData.instructor = instructor;
    if (other !== undefined) updateData.other = other;
    updateData.updatedBy = tenantContext.user.id;

    const updatedTrial = await prisma.trial.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedTrial.id),
      entityType: 'trial',
      description: 'Trial updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(updatedTrial));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific trial
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

    // Check if user has permission to delete trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid trial ID' },
        { status: 400 },
      );
    }

    // Check if trial exists and belongs to tenant
    const existingTrial = await prisma.trial.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingTrial) {
      return NextResponse.json(
        { message: 'Trial not found' },
        { status: 404 },
      );
    }

    await prisma.trial.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'trial',
      description: 'Trial deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Trial deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
