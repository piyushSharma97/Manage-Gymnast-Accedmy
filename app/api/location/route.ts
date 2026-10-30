import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { UserStatus } from '@prisma/client';

// GET: Fetch all locations
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'id';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const skip = (page - 1) * limit;

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

    const whereClause: any = {
      AND: [
        {
          tenantId: tenantContext.tenantId,
        },
        {
          OR: [
            {
              centerName: {
                contains: query,
              },
            },
            {
              centerCode: {
                contains: query,
              },
            },
            {
              city: {
                contains: query,
              },
            },
            {
              state: {
                contains: query,
              },
            },
          ],
        },
      ],
    };

    if (isActive === 'true' || isActive === 'false') {
      whereClause.AND.push({ isActive: isActive === 'true' });
    }

    // Count total records matching the filter
    const total = await prisma.location.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.location.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    let locations: any[] = [];
    if (total > 0) {
      try {
        locations = await prisma.location.findMany({
          skip,
          take: limit,
          where: whereClause,
          orderBy: {
            [sortField]: sortDirection,
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
      } catch (error: any) {
           
      }
    }

    return NextResponse.json({
      data: locations,
      pagination: {
        total,
        page,
      },
      empty: isTableEmpty,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new location
export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create locations
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    // Get tenantId from request body (for admin) or from context
    const tenantId = typeof body?.tenantId === 'number' ? body.tenantId : tenantContext.tenantId;

    // Ensure tenantId is available
    if (!tenantId) {
      return NextResponse.json(
        { message: 'Tenant ID is required' },
        { status: 400 },
      );
    }

    // Verify admin can only create locations for their tenant
    if (tenantContext.isAdmin && tenantId !== tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Insufficient permissions to create location for this tenant' },
        { status: 403 },
      );
    }

    const centerName = typeof body?.centerName === 'string' ? body.centerName.trim() : '';
    const centerCode = typeof body?.centerCode === 'string' ? body.centerCode.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const addressLine1 = typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    const addressLine2 = typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : '';
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const state = typeof body?.state === 'string' ? body.state.trim() : '';
    const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim() : '';
    // Default country to India
    const country = typeof body?.country === 'string' && body.country.trim() ? body.country.trim() : 'India';
    const managerName = typeof body?.managerName === 'string' ? body.managerName.trim() : '';
    const managerPhone = typeof body?.managerPhone === 'string' ? body.managerPhone.trim() : '';
    const managerEmail = typeof body?.managerEmail === 'string' ? body.managerEmail.trim() : '';
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    if (!centerName || centerName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid centerName' },
        { status: 400 },
      );
    }

    if (!centerCode || centerCode.length > 20) {
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

    // Validate phone number is exactly 10 digits if provided
    if (phone && !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { message: 'Phone number must be exactly 10 digits' },
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

    // Validate manager phone number is exactly 10 digits if provided
    if (managerPhone && !/^\d{10}$/.test(managerPhone)) {
      return NextResponse.json(
        { message: 'Manager phone number must be exactly 10 digits' },
        { status: 400 },
      );
    }

    if (managerEmail && managerEmail.length > 100) {
      return NextResponse.json(
        { message: 'Invalid managerEmail' },
        { status: 400 },
      );
    }

    // Ensure the center name is unique within the tenant
    const uniqueName = await isUnique('location', { 
      centerName, 
      tenantId: tenantId,
    });
    if (!uniqueName) {
      return NextResponse.json(
        { message: 'Center name must be unique within the tenant' },
        { status: 400 },
      );
    }

    // Ensure the center code is unique within the tenant
    const uniqueCode = await isUnique('location', { 
      centerCode, 
      tenantId: tenantId,
    });
    if (!uniqueCode) {
      return NextResponse.json(
        { message: 'Center code must be unique within the tenant' },
        { status: 400 },
      );
    }

    // Use transaction to create location and user atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the location
      const newLocation = await tx.location.create({
        data: {
          tenantId: tenantId,
          centerName,
          centerCode,
          email: email || null,
          phone: phone || null,
          // Required fields - use empty string if not provided (Prisma schema requires non-null)
          addressLine1: addressLine1 || '',
          addressLine2: addressLine2 || null,
          city: city || '',
          state: state || '',
          postalCode: postalCode || '',
          country: country || 'India',
          managerName: managerName || null,
          managerPhone: managerPhone || null,
          managerEmail: managerEmail || null,
          isActive,
          createdBy: tenantContext.user.id,
        },
      });

      // Create a manager user for this location if email is provided
      let createdUser = null;
      if (email && email.trim()) {
        // Check if user with this email already exists
        const existingUser = await tx.user.findUnique({
          where: { email: email.trim() },
        });

        if (!existingUser) {
          // Verify roleId 3 (Manager) exists
          const managerRole = await tx.userRole.findUnique({
            where: { id: 3 },
          });

          if (managerRole) {
            // Create user with roleId = 3 (Manager)
            createdUser = await tx.user.create({
              data: {
                email: email.trim(),
                name: centerName,
                roleId: 3, // Manager role
                tenantId: tenantId,
                locationId: newLocation.id,
                status: UserStatus.ACTIVE,
                createdBy: tenantContext.user.id,
              },
            });

            // Update location with userId
            return await tx.location.update({
              where: { id: newLocation.id },
              data: { userId: createdUser.id },
            });
          }
        }
      }

      return newLocation;
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(result.id),
      entityType: 'location',
      description: 'Location added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
