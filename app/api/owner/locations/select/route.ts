import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch all locations across all tenants (owner only)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get('active');
  const tenantId = searchParams.get('tenantId');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {};

    // Filter by tenant if provided
    if (tenantId) {
      const tenantIdNum = parseInt(tenantId);
      if (!isNaN(tenantIdNum)) {
        whereClause.tenantId = tenantIdNum;
      }
    }

    // Filter by active status if provided
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
        tenantId: true,
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

