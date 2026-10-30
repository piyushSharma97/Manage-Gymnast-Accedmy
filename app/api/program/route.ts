import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import {
  ProgramSchema,
  ProgramSchemaType,
} from '@/app/api/program/forms/program-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

// GET: Fetch all programs
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('isActive');
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

    // Check if user has permission to view programs
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Count total records matching the filter
    const total = await prisma.program.count({
      where: {
        AND: [
          {
            tenantId: tenantContext.tenantId,
          },
          {
            name: {
              contains: query,
            },
          },
          ...(isActive !== null ? [{ isActive: isActive === 'true' }] : []), // Filter by isActive if provided
        ],
      },
    });

    let isTableEmpty = false;

    if (total === 0) {
      // Check if the entire table is empty
      const overallTotal = await prisma.program.count({
        where: {
          tenantId: tenantContext.tenantId,
        },
      });
      isTableEmpty = overallTotal === 0;
    }

    // Get paginated records if total > 0
    const programs =
      total > 0
        ? await prisma.program.findMany({
            skip,
            take: limit,
            where: {
              AND: [
                {
                  tenantId: tenantContext.tenantId,
                },
                {
                  name: {
                    contains: query,
                  },
                },
                ...(isActive !== null ? [{ isActive: isActive === 'true' }] : []), // Filter by isActive if provided
              ],
            },
            orderBy: {
              [sortField]: sortDirection,
            },
          })
        : [];

    return NextResponse.json({
      data: programs,
      pagination: {
        total,
        page,
      },
      empty: isTableEmpty, // Use the fallback check
    });
  } catch (error: any) {
    console.error("API Error:", error);

    // Return the exact error message (e.g., from error.message)
    return NextResponse.json(
      { message: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

// POST: Add a new program
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

    // Check if user has permission to create programs
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const parsedData = ProgramSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { message: 'Invalid input. Please check your data and try again.' },
        { status: 400 }, // Bad Request
      );
    }

    const { name, code, description, ageMin, ageMax, durationWeeks, sessionType, isActive }: ProgramSchemaType = parsedData.data;

    // Validate tenant context
    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Invalid tenant context' },
        { status: 400 },
      );
    }

    // Debug: Log tenant context
    console.log('Tenant Context:', {
      userId: tenantContext.user.id,
      tenantId: tenantContext.tenantId,
      roleSlug: tenantContext.user.roleSlug
    });

    // Verify tenant exists in database
    const tenantExists = await prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId }
    });

    if (!tenantExists) {
      return NextResponse.json(
        { message: 'Tenant not found' },
        { status: 400 },
      );
    }

    // Ensure the program name is unique within the tenant
    const existingProgram = await prisma.program.findFirst({
      where: {
        name: name,
        tenantId: tenantContext.tenantId,
      },
    });

    if (existingProgram) {
      return NextResponse.json(
        { message: 'Program name must be unique within your organization' },
        { status: 400 },
      );
    }

    // If code is provided, ensure it's unique within the tenant
    if (code) {
      const existingProgramWithCode = await prisma.program.findFirst({
        where: {
          code: code,
          tenantId: tenantContext.tenantId,
        },
      });

      if (existingProgramWithCode) {
        return NextResponse.json(
          { message: 'Program code must be unique within your organization' },
          { status: 400 },
        );
      }
    }

    const newProgram = await prisma.program.create({
      data: { 
        name, 
        code,
        description,
        ageMin,
        ageMax,
        durationWeeks,
        sessionType,
        isActive,
        tenantId: tenantContext.tenantId,
        createdBy: tenantContext.user.id,
      },
    });

    // Log the event
    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newProgram.id),
      entityType: 'program',
      description: 'Program added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newProgram);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
