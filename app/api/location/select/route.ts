import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch locations for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get('active');

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
    const canSelect =
      tenantContext.isOwner ||
      tenantContext.isAdmin ||
      tenantContext.isManager ||
      tenantContext.isCoach;
    if (!canSelect) {
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
      tenantId: tenantContext.tenantId,
    };

    // Manager/coach: only their assigned center (same UX as admin dropdown, single option)
    if (
      (tenantContext.isManager || tenantContext.isCoach) &&
      !tenantContext.isOwner &&
      !tenantContext.isAdmin
    ) {
      if (!tenantContext.locationId) {
        return NextResponse.json(
          { message: 'No center assigned to your profile' },
          { status: 400 },
        );
      }
      whereClause.id = tenantContext.locationId;
    }

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    const locations = await prisma.location.findMany({
      where: whereClause,
      select: {
        id: true,
        centerName: true,
        centerCode: true,
        email: true,
        phone: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        managerName: true,
        managerPhone: true,
        managerEmail: true,
        isActive: true,
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
      orderBy: [
        { centerName: 'asc' },
      ],
    });

    return NextResponse.json(locations);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
