import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthContext } from './auth';
import { TenantContext } from './tenant';

export interface PermissionContext {
  hasPermission: boolean;
  permissions: string[];
  missingPermissions: string[];
}

export interface PermissionMiddlewareOptions {
  requiredPermissions?: string[];
  requireAllPermissions?: boolean;
  allowOwnerBypass?: boolean;
}

/**
 * Permission middleware that validates user permissions for specific actions
 */
export async function permissionMiddleware(
  request: NextRequest,
  authContext: AuthContext,
  tenantContext: TenantContext,
  options: PermissionMiddlewareOptions = {}
): Promise<{ context: PermissionContext | null; response: NextResponse | null }> {
  const {
    requiredPermissions = [],
    requireAllPermissions = true,
    allowOwnerBypass = true,
  } = options;

  try {
    // Owner bypass - owners have all permissions
    if (authContext.isOwner && allowOwnerBypass) {
      return {
        context: {
          hasPermission: true,
          permissions: ['*'], // Owner has all permissions
          missingPermissions: [],
        },
        response: null,
      };
    }

    // If no permissions required, allow access
    if (requiredPermissions.length === 0) {
      return {
        context: {
          hasPermission: true,
          permissions: [],
          missingPermissions: [],
        },
        response: null,
      };
    }

    // Get user permissions from database
    const userPermissions = await prisma.userRole.findUnique({
      where: { id: authContext.user.roleId },
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!userPermissions) {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'Role not found' },
          { status: 404 }
        ),
      };
    }

    // Extract permission slugs
    const userPermissionSlugs = userPermissions.permissions.map(
      (rp) => rp.permission.slug
    );

    // Check if user has required permissions
    const hasRequiredPermissions = requireAllPermissions
      ? requiredPermissions.every((permission) => userPermissionSlugs.includes(permission))
      : requiredPermissions.some((permission) => userPermissionSlugs.includes(permission));

    const missingPermissions = requiredPermissions.filter(
      (permission) => !userPermissionSlugs.includes(permission)
    );

    if (!hasRequiredPermissions) {
      return {
        context: {
          hasPermission: false,
          permissions: userPermissionSlugs,
          missingPermissions,
        },
        response: NextResponse.json(
          { 
            message: 'Insufficient permissions',
            missingPermissions,
          },
          { status: 403 }
        ),
      };
    }

    return {
      context: {
        hasPermission: true,
        permissions: userPermissionSlugs,
        missingPermissions: [],
      },
      response: null,
    };
  } catch (error) {
    console.error('Permission middleware error:', error);
    return {
      context: null,
      response: NextResponse.json(
        { message: 'Permission validation error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Helper function to check if user has specific permission
 */
export function hasPermission(
  permissionContext: PermissionContext,
  permission: string
): boolean {
  if (permissionContext.permissions.includes('*')) return true; // Owner has all permissions
  return permissionContext.permissions.includes(permission);
}

/**
 * Helper function to check if user has any of the specified permissions
 */
export function hasAnyPermission(
  permissionContext: PermissionContext,
  permissions: string[]
): boolean {
  if (permissionContext.permissions.includes('*')) return true; // Owner has all permissions
  return permissions.some((permission) => permissionContext.permissions.includes(permission));
}

/**
 * Helper function to check if user has all of the specified permissions
 */
export function hasAllPermissions(
  permissionContext: PermissionContext,
  permissions: string[]
): boolean {
  if (permissionContext.permissions.includes('*')) return true; // Owner has all permissions
  return permissions.every((permission) => permissionContext.permissions.includes(permission));
}

/**
 * Helper function to get permission-based data filters
 */
export function getPermissionFilters(
  permissionContext: PermissionContext,
  authContext: AuthContext,
  tenantContext: TenantContext
) {
  const filters: { tenantId?: number; locationId?: number } = {};

  // Add tenant filter based on access level
  if (authContext.isOwner) {
    // Owner can access all data
    if (tenantContext.tenant) {
      filters.tenantId = tenantContext.tenant.id;
    }
  } else if (authContext.isAdmin) {
    // Admin can access their tenant's data
    if (tenantContext.tenant) {
      filters.tenantId = tenantContext.tenant.id;
    }
  } else if (authContext.isManager) {
    // Manager can only access their location's data
    if (tenantContext.tenant && tenantContext.location) {
      filters.tenantId = tenantContext.tenant.id;
      filters.locationId = tenantContext.location.id;
    }
  }

  return filters;
}

/**
 * Helper function to validate resource access based on permissions and context
 */
export function validateResourceAccess(
  permissionContext: PermissionContext,
  authContext: AuthContext,
  tenantContext: TenantContext,
  resourceTenantId?: number,
  resourceLocationId?: number
): boolean {
  // Owner can access all resources
  if (authContext.isOwner) return true;

  // Check tenant access
  if (resourceTenantId && tenantContext.tenant) {
    if (tenantContext.tenant.id !== resourceTenantId) return false;
  }

  // Check location access for managers
  if (authContext.isManager && resourceLocationId && tenantContext.location) {
    if (tenantContext.location.id !== resourceLocationId) return false;
  }

  return true;
}

/**
 * Helper function to get role-based access patterns
 */
export function getRoleAccessPattern(
  authContext: AuthContext,
  tenantContext: TenantContext
): {
  canViewAllTenants: boolean;
  canViewAllLocations: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
} {
  console.log('tenantContext:', tenantContext);
  return {
    canViewAllTenants: authContext.isOwner,
    canViewAllLocations: authContext.isOwner || authContext.isAdmin,
    canManageUsers: authContext.isOwner || authContext.isAdmin,
    canManageSettings: authContext.isOwner || authContext.isAdmin,
  };
}
