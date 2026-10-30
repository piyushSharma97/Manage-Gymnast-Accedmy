import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific location by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view locations
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
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

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    const location = await prisma.location.findFirst({
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

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(location);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific location
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

    // Check if user has permission to update locations
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
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
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const centerName = typeof body?.centerName === 'string' ? body.centerName.trim() : '';
    const centerCode = typeof body?.centerCode === 'string' ? body.centerCode.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const addressLine1 = typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    const addressLine2 = typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : '';
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const state = typeof body?.state === 'string' ? body.state.trim() : '';
    const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim() : '';
    const country = typeof body?.country === 'string' ? body.country.trim() : '';
    const managerName = typeof body?.managerName === 'string' ? body.managerName.trim() : '';
    const managerPhone = typeof body?.managerPhone === 'string' ? body.managerPhone.trim() : '';
    const managerEmail = typeof body?.managerEmail === 'string' ? body.managerEmail.trim() : '';
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;

    // Check if location exists and belongs to tenant
    const existingLocation = await prisma.location.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 },
      );
    }

    if (centerName && centerName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid centerName' },
        { status: 400 },
      );
    }

    if (centerCode && centerCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid centerCode' },
        { status: 400 },
      );
    }

    if (email && email.length > 100) {
      return NextResponse.json(
        { message: 'Invalid email' },
        { status: 400 },
      );
    }

    if (phone && phone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid phone' },
        { status: 400 },
      );
    }

    if (addressLine1 && addressLine1.length > 200) {
      return NextResponse.json(
        { message: 'Invalid addressLine1' },
        { status: 400 },
      );
    }

    if (addressLine2 && addressLine2.length > 200) {
      return NextResponse.json(
        { message: 'Invalid addressLine2' },
        { status: 400 },
      );
    }

    if (city && city.length > 50) {
      return NextResponse.json(
        { message: 'Invalid city' },
        { status: 400 },
      );
    }

    if (state && state.length > 50) {
      return NextResponse.json(
        { message: 'Invalid state' },
        { status: 400 },
      );
    }

    if (postalCode && postalCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid postalCode' },
        { status: 400 },
      );
    }

    if (country && country.length > 50) {
      return NextResponse.json(
        { message: 'Invalid country' },
        { status: 400 },
      );
    }

    if (managerName && managerName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid managerName' },
        { status: 400 },
      );
    }

    if (managerPhone && managerPhone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid managerPhone' },
        { status: 400 },
      );
    }

    if (managerEmail && managerEmail.length > 100) {
      return NextResponse.json(
        { message: 'Invalid managerEmail' },
        { status: 400 },
      );
    }

    // Check uniqueness for center name if provided and different from current
    if (centerName && centerName !== existingLocation.centerName) {
      const uniqueName = await isUnique('location', { 
        centerName, 
        tenantId: tenantContext.tenantId,
      });
      if (!uniqueName) {
        return NextResponse.json(
          { message: 'Center name must be unique within the tenant' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for center code if provided and different from current
    if (centerCode && centerCode !== existingLocation.centerCode) {
      const uniqueCode = await isUnique('location', { 
        centerCode, 
        tenantId: tenantContext.tenantId,
      });
      if (!uniqueCode) {
        return NextResponse.json(
          { message: 'Center code must be unique within the tenant' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (centerName) updateData.centerName = centerName;
    if (centerCode) updateData.centerCode = centerCode;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1 || null;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (postalCode !== undefined) updateData.postalCode = postalCode || null;
    if (country !== undefined) updateData.country = country || null;
    if (managerName !== undefined) updateData.managerName = managerName || null;
    if (managerPhone !== undefined) updateData.managerPhone = managerPhone || null;
    if (managerEmail !== undefined) updateData.managerEmail = managerEmail || null;
    if (isActive !== null) updateData.isActive = isActive;
    updateData.updatedBy = tenantContext.user.id;

    const updatedLocation = await prisma.location.update({
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
      entityId: String(updatedLocation.id),
      entityType: 'location',
      description: 'Location updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedLocation);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific location
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

    // Check if user has permission to delete locations
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
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
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    // Check if location exists and belongs to tenant
    const existingLocation = await prisma.location.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 },
      );
    }

    // Check if location is being used by students
    const studentsCount = await prisma.student.count({
      where: { locationId: id },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete location that has associated students' },
        { status: 400 },
      );
    }

    // Check if location is being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { locationId: id },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete location that has associated enrollments' },
        { status: 400 },
      );
    }

    // Check if location is being used by payments
    const paymentsCount = await prisma.payment.count({
      where: { locationId: id },
    });

    if (paymentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete location that has associated payments' },
        { status: 400 },
      );
    }

    // Check if location is being used by users
    const usersCount = await prisma.user.count({
      where: { locationId: id },
    });

    if (usersCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete location that has associated users' },
        { status: 400 },
      );
    }

    await prisma.location.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'location',
      description: 'Location deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Location deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
