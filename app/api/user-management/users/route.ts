import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import {
  UserAddSchema,
  UserAddSchemaType,
} from '@/app/owner/user-management/users/forms/user-add-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { UserStatus } from '@/app/models/user';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'name';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const status = searchParams.get('status') || null;
  const roleIdParam = searchParams.get('roleId') || null;

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(req);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view users
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Map status query to enum type, fallback to null if invalid
    const statusFilter =
      status && status !== 'all' ? (status as UserStatus) : undefined;
    const roleIdFilter =
      roleIdParam && roleIdParam !== 'all' && !Number.isNaN(Number(roleIdParam))
        ? Number(roleIdParam)
        : undefined;

    // Create tenant-aware filters
    const tenantFilters = createTenantFilters(tenantContext);

    // Count total users with filters
    const totalCount = await prisma.user.count({
      where: {
        AND: [
          ...(statusFilter ? [{ status: statusFilter }] : []),
          ...(roleIdFilter !== undefined ? [{ roleId: roleIdFilter }] : []),
          {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
            ],
          },
          ...(Object.keys(tenantFilters).length > 0 ? [tenantFilters] : []),
        ],
      },
    });

    // Set order logic
    const sortMap: Record<string, Prisma.UserOrderByWithRelationInput> = {
      name: { name: sortDirection as Prisma.SortOrder },
      role_name: { role: { name: sortDirection as Prisma.SortOrder } },
      status: { status: sortDirection as Prisma.SortOrder },
      createdAt: { createdAt: sortDirection as Prisma.SortOrder },
      lastSignInAt: { lastSignInAt: sortDirection as Prisma.SortOrder },
    };

    // Default to createdAt sorting if no valid field is found
    const orderBy = sortMap[sortField] || {
      createdAt: sortDirection as Prisma.SortOrder,
    };

    // Fetch users with filters
    const users = await prisma.user.findMany({
      where: {
        AND: [
          ...(statusFilter ? [{ status: statusFilter }] : []),
          ...(roleIdFilter !== undefined ? [{ roleId: roleIdFilter }] : []),
          {
            OR: [
              { name: { contains: query } },
              { email: { contains: query } },
            ],
          },
          ...(Object.keys(tenantFilters).length > 0 ? [tenantFilters] : []),
        ],
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      select: {
        id: true,
        isTrashed: true,
        avatar: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        lastSignInAt: true,
        tenantId: true,
        locationId: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: users,
      pagination: {
        total: totalCount,
        page,
        limit,
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

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

    // Check if user has permission to create users
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const parsedData = UserAddSchema.safeParse(body);

    if (!parsedData.success) {
      return NextResponse.json(
        { error: 'Invalid input.' },
        { status: 400 }, // Bad request
      );
    }

    const { name, email, roleId }: UserAddSchemaType = parsedData.data;

    // Check if the email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email is already registered.' },
        { status: 409 }, // Conflict
      );
    }

    // Check if the role exists
    const numericRoleId = Number(roleId);
    if (Number.isNaN(numericRoleId)) {
      return NextResponse.json(
        { message: 'Invalid role selected.' },
        { status: 400 },
      );
    }

    const existingRole = await prisma.userRole.findUnique({
      where: { id: numericRoleId },
    });

    if (!existingRole) {
      return NextResponse.json(
        {
          message:
            'Selected role does not exist. Someone might have deleted it already.',
        },
        { status: 404 }, // Not found
      );
    }

    // Use a transaction to insert multiple records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create a user with tenant context
      const user = await tx.user.create({
        data: {
          name,
          email,
          status: UserStatus.ACTIVE,
          roleId: numericRoleId,
          tenantId: tenantContext.tenantId,
          locationId: tenantContext.locationId,
          createdBy: tenantContext.user.id,
        },
      });

      // Log the event
      await systemLog(
        {
          event: 'create',
          userId: tenantContext.user.id,
          entityId: user.id,
          entityType: 'user',
          description: 'User added by user.',
          ipAddress: clientIp,
        },
        tx,
      );

      return user;
    });

    return NextResponse.json(
      {
        message: 'User successfully added.',
        user: result,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
