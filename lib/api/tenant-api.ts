import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, createTenantFilters, validateResourceAccess, TenantContext } from './tenant-helpers';
import { prisma } from '@/lib/prisma';

/**
 * Higher-order function to wrap API routes with tenant-aware functionality
 */
export function withTenantAuth<T = unknown>(
  handler: (request: NextRequest, context: unknown, tenantContext: TenantContext) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse<T | { message: string }>> => {
    try {
      // Get tenant context from session
      const tenantContext = await getTenantContext(request);
      
      if (!tenantContext) {
        return NextResponse.json(
          { message: 'Authentication required' },
          { status: 401 }
        );
      }

      // Call the original handler with tenant context
      return handler(request, context, tenantContext);
    } catch (error) {
      console.error('Tenant auth wrapper error:', error);
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper function to create tenant-aware database queries
 */
export function createTenantQuery(tenantContext: TenantContext, baseWhere: Record<string, unknown> = {}) {
  const tenantFilters = createTenantFilters(tenantContext);
  return {
    ...baseWhere,
    ...tenantFilters,
  };
}

/**
 * Helper function to validate resource access before database operations
 */
export function validateResourceAccessMiddleware(
  tenantContext: TenantContext,
  resourceTenantId?: number,
  resourceLocationId?: number
) {
  if (!validateResourceAccess(tenantContext, resourceTenantId, resourceLocationId)) {
    throw new Error('Access denied to this resource');
  }
}

/**
 * Helper function to get pagination parameters from request
 */
export function getPaginationParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Helper function to get sorting parameters from request
 */
export function getSortingParams(request: NextRequest, defaultSort: string = 'createdAt') {
  const { searchParams } = new URL(request.url);
  const sortField = searchParams.get('sort') || defaultSort;
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  
  return { sortField, sortDirection };
}

/**
 * Helper function to get search parameters from request
 */
export function getSearchParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const status = searchParams.get('status') || '';
  
  return { query, status };
}

/**
 * Helper function to create search filters
 */
export function createSearchFilters(searchParams: { query?: string }, searchFields: string[]) {
  if (!searchParams.query) return {};
  
  return {
    OR: searchFields.map(field => ({
      [field]: {
        contains: searchParams.query,
        mode: 'insensitive' as const,
      },
    })),
  };
}

/**
 * Helper function to create response with pagination
 */
export function createPaginatedResponse(data: unknown[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/**
 * Helper function to handle tenant-aware student queries
 */
export async function getStudentsWithTenantFilter(
  tenantContext: TenantContext,
  request: NextRequest
) {
  const { page, limit, skip } = getPaginationParams(request);
  const { sortField, sortDirection } = getSortingParams(request, 'firstName');
  const { query, status } = getSearchParams(request);
  
  const whereClause = createTenantQuery(tenantContext, {
    ...(query && {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { registrationNo: { contains: query, mode: 'insensitive' } },
      ],
    }),
    ...(status && status !== 'all' && { status }),
  });

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDirection },
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        status: true,
        joinDate: true,
        createdAt: true,
        sportCategoryName: true,
        skilllevelName: true,
      },
    }),
    prisma.student.count({ where: whereClause }),
  ]);

  return createPaginatedResponse(students, total, page, limit);
}

/**
 * Helper function to handle tenant-aware employee queries
 */
export async function getEmployeesWithTenantFilter(
  tenantContext: TenantContext,
  request: NextRequest
) {
  const { page, limit, skip } = getPaginationParams(request);
  const { sortField, sortDirection } = getSortingParams(request, 'firstName');
  const { query } = getSearchParams(request);
  
  const whereClause = createTenantQuery(tenantContext, {
    ...(query && {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    }),
  });

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDirection },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        hiredDate: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.employee.count({ where: whereClause }),
  ]);

  return createPaginatedResponse(employees, total, page, limit);
}

/**
 * Helper function to handle tenant-aware batch queries
 */
export async function getBatchesWithTenantFilter(
  tenantContext: TenantContext,
  request: NextRequest
) {
  const { page, limit, skip } = getPaginationParams(request);
  const { sortField, sortDirection } = getSortingParams(request, 'createdAt');
  const { query } = getSearchParams(request);
  
  const whereClause = createTenantQuery(tenantContext, {
    ...(query && {
      name: { contains: query, mode: 'insensitive' },
    }),
  });

  const [batches, total] = await Promise.all([
    prisma.batch.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDirection },
      include: {
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        course: {
          select: {
            id: true,
            courseName: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.batch.count({ where: whereClause }),
  ]);

  return createPaginatedResponse(batches, total, page, limit);
}
