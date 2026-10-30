import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

export interface TenantContext {
  user: {
    id: string;
    roleSlug: string;
    tenantId?: number;
    locationId?: number;
  };
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCoach: boolean;
  isParent: boolean;
  tenantId?: number;
  locationId?: number;
}

/**
 * Get tenant context from session for API routes
 */
export async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  try {
    // First try to get from headers (set by middleware)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');
    const tenantId = request.headers.get('x-tenant-id');
    const locationId = request.headers.get('x-location-id');

    if (userId && userRole) {
      const isOwner = userRole === 'owner';
      const isAdmin = userRole === 'admin';
      const isManager = userRole === 'manager';
      const isCoach = userRole === 'coach';
      const isParent = userRole === 'parent' || userRole === 'guardian';
      return {
        user: {
          id: userId,
          roleSlug: userRole,
          tenantId: tenantId ? parseInt(tenantId) : undefined,
          locationId: locationId ? parseInt(locationId) : undefined,
        },
        isOwner,
        isAdmin,
        isManager,
        isCoach,
        isParent,
        tenantId: tenantId ? parseInt(tenantId) : undefined,
        locationId: locationId ? parseInt(locationId) : undefined,
      };
    }

    // Fallback to session if headers not available
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return null;
    }

    const isOwner = session.user.roleSlug === 'owner';
    const isAdmin = session.user.roleSlug === 'admin';
    const isManager = session.user.roleSlug === 'manager';
    const isCoach = session.user.roleSlug === 'coach';
    const isParent = session.user.roleSlug === 'parent' || session.user.roleSlug === 'guardian';
    return {
      user: {
        id: session.user.id,
        roleSlug: session.user.roleSlug || '',
        tenantId: session.user.tenantId ?? undefined,
        locationId: session.user.locationId ?? undefined,
      },
      isOwner,
      isAdmin,
      isManager,
      isCoach,
      isParent,
      tenantId: session.user.tenantId ?? undefined,
      locationId: session.user.locationId ?? undefined,
    };
  } catch (error) {
    console.error('Error getting tenant context:', error);
    return null;
  }
}

/**
 * Create database filters based on tenant context
 */
export function createTenantFilters(context: TenantContext, additionalFilters: Record<string, unknown> = {}) {
  const filters = { ...additionalFilters };

  // Owner can access all data (no tenant filter unless specified)
  if (context.isOwner) {
    // If owner wants to filter by specific tenant, it should be passed in additionalFilters
    return filters;
  }

  // Admin can access their tenant's data
  if (context.isAdmin && context.tenantId) {
    filters.tenantId = context.tenantId;
  }

  // Manager can only access their location's data
  if (context.isManager && context.tenantId && context.locationId) {
    filters.tenantId = context.tenantId;
    filters.locationId = context.locationId;
  }
  // Coach can only access their location's data (read-only)
  if (context.isCoach && context.tenantId && context.locationId) {
    filters.tenantId = context.tenantId;
    filters.locationId = context.locationId;
  }
  return filters;
}

/**
 * Validate if user can access a specific resource
 */
export function validateResourceAccess(
  context: TenantContext,
  resourceTenantId?: number,
  resourceLocationId?: number
): boolean {
  // Owner can access all resources
  if (context.isOwner) return true;

  // Check tenant access
  if (resourceTenantId && context.tenantId) {
    if (context.tenantId !== resourceTenantId) return false;
  }

  // Check location access for managers
  if (context.isManager && resourceLocationId && context.locationId) {
    if (context.locationId !== resourceLocationId) return false;
  }
 // Check location access for coaches
  if (context.isCoach && resourceLocationId && context.locationId) {
    if (context.locationId !== resourceLocationId) return false;
  }
  return true;
}

/**
 * Get user's access level for UI rendering
 */
export function getUserAccessLevel(context: TenantContext): 'owner' | 'admin' | 'manager'| 'coach' | 'none' {
  if (context.isOwner) return 'owner';
  if (context.isAdmin) return 'admin';
  if (context.isManager) return 'manager';
  if (context.isCoach) return 'coach';
  return 'none';
}

/**
 * Check if user can perform specific actions
 */
export function canPerformAction(
  context: TenantContext,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
): boolean {
  // Owner can do everything
  if (context.isOwner) return true;

  // Admin can do most things within their tenant
  if (context.isAdmin) {
    return ['create', 'read', 'update', 'delete', 'manage'].includes(action);
  }

  // Manager has limited access
  if (context.isManager) {
    return ['create', 'read', 'update'].includes(action);
  }
  if (context.isCoach) {
    return ['create', 'read', 'update'].includes(action);
  }
  return false;
}

/**
 * Create audit log context
 */
export function createAuditContext(context: TenantContext, action: string, resourceId?: string) {
  return {
    userId: context.user.id,
    userRole: context.user.roleSlug,
    tenantId: context.tenantId,
    locationId: context.locationId,
    action,
    resourceId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get tenant information for the current user
 */
export async function getTenantInfo(context: TenantContext) {
  if (!context.tenantId) return null;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: context.tenantId },
      select: {
        id: true,
        academyName: true,
        academyCode: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionPlan: {
          select: {
            planName: true,
            maxCenters: true,
            maxStudentsPerCenter: true,
          },
        },
      },
    });

    return tenant;
  } catch (error) {
    console.error('Error getting tenant info:', error);
    return null;
  }
}

/**
 * Get location information for the current user
 */
export async function getLocationInfo(context: TenantContext) {
  if (!context.locationId) return null;

  try {
    const location = await prisma.location.findUnique({
      where: { id: context.locationId },
      select: {
        id: true,
        centerName: true,
        centerCode: true,
        isActive: true,
        city: true,
        state: true,
        country: true,
      },
    });

    return location;
  } catch (error) {
    console.error('Error getting location info:', error);
    return null;
  }
}

/**
 * Get all locations for admin users
 */
export async function getAdminLocations(context: TenantContext) {
  if (!context.isAdmin || !context.tenantId) return [];

  try {
    const locations = await prisma.location.findMany({
      where: {
        tenantId: context.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        centerName: true,
        centerCode: true,
        city: true,
        state: true,
        country: true,
      },
      orderBy: {
        centerName: 'asc',
      },
    });

    return locations;
  } catch (error) {
    console.error('Error getting admin locations:', error);
    return [];
  }
}

/**
 * Get all tenants for owner users
 */
export async function getOwnerTenants(context: TenantContext) {
  if (!context.isOwner) return [];

  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        academyName: true,
        academyCode: true,
        subscriptionStatus: true,
        subscriptionPlan: {
          select: {
            planName: true,
          },
        },
        _count: {
          select: {
            locations: true,
            students: true,
            employees: true,
          },
        },
      },
      orderBy: {
        academyName: 'asc',
      },
    });

    return tenants;
  } catch (error) {
    console.error('Error getting owner tenants:', error);
    return [];
  }
}
