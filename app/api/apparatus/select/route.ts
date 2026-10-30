import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch apparatus for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get('active');
  const gender = searchParams.get('gender');

  try {
    // Get tenant context for authentication
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view apparatus
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {};

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    if (gender) {
      whereClause.gender = gender;
    }

    const apparatus = await prisma.apparatus.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        shortName: true,
        gender: true,
        sequence: true,
        isActive: true,
      },
      orderBy: [
        { sequence: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(apparatus);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

