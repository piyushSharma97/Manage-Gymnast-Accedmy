import { NextRequest } from 'next/server';
import { MiddlewareContext } from './index';

/**
 * Helper function to extract middleware context from request headers
 * This is used by API routes to get the middleware context
 */
export function getMiddlewareContextFromHeaders(request: NextRequest): Partial<MiddlewareContext> | null {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  const tenantId = request.headers.get('x-tenant-id');
  const locationId = request.headers.get('x-location-id');

  if (!userId || !userRole) {
    return null;
  }

  return {
    auth: {
      user: {
        id: userId,
        roleName: userRole,
        // Add other required fields as needed
        email: '',
        name: '',
        roleId: 0,
        tenantId: tenantId ? parseInt(tenantId) : undefined,
        locationId: locationId ? parseInt(locationId) : undefined,
        status: 'ACTIVE',
      },
      isAuthenticated: true,
      isOwner: userRole === 'owner',
      isAdmin: userRole === 'admin',
      isManager: userRole === 'manager',
        isCoach: userRole === 'coach',
    },
    tenant: {
      tenant: tenantId ? {
        id: parseInt(tenantId),
        academyName: '',
        academyCode: '',
        isActive: true,
        subscriptionStatus: 'active',
      } : null,
      location: locationId ? {
        id: parseInt(locationId),
        centerName: '',
        centerCode: '',
        isActive: true,
      } : null,
      hasAccess: true,
      accessLevel: userRole as 'owner' | 'admin' | 'manager' | 'coach' | 'none',
    },
    permissions: {
      hasPermission: true,
      permissions: [],
      missingPermissions: [],
    },
    request,
  };
}

/**
 * Helper function to create tenant-aware database query filters
 */
export function createDatabaseFilters(middlewareContext: Partial<MiddlewareContext>) {
  if (!middlewareContext.auth || !middlewareContext.tenant) {
    return {};
  }

  const filters: { tenantId?: number; locationId?: number } = {};

  // Add tenant filter
  if (middlewareContext.tenant.tenant) {
    filters.tenantId = middlewareContext.tenant.tenant.id;
  }

  // Add location filter for managers
  if (middlewareContext.auth.isManager && middlewareContext.tenant.location) {
    filters.locationId = middlewareContext.tenant.location.id;
  }
  // Add location filter for coaches
  if (middlewareContext.auth.isCoach && middlewareContext.tenant.location) {
    filters.locationId = middlewareContext.tenant.location.id;
  }
  return filters;
}

/**
 * Helper function to validate if user can access a specific resource
 */
export function validateResourceAccess(
  middlewareContext: Partial<MiddlewareContext>,
  resourceTenantId?: number,
  resourceLocationId?: number
): boolean {
  if (!middlewareContext.auth || !middlewareContext.tenant) {
    return false;
  }

  // Owner can access all resources
  if (middlewareContext.auth.isOwner) return true;

  // Check tenant access
  if (resourceTenantId && middlewareContext.tenant.tenant) {
    if (middlewareContext.tenant.tenant.id !== resourceTenantId) return false;
  }

  // Check location access for managers
  if (middlewareContext.auth.isManager && resourceLocationId && middlewareContext.tenant.location) {
    if (middlewareContext.tenant.location.id !== resourceLocationId) return false;
  }
  // Check location access for coaches
  if (middlewareContext.auth.isCoach && resourceLocationId && middlewareContext.tenant.location) {
    if (middlewareContext.tenant.location.id !== resourceLocationId) return false;
  }
  return true;
}

/**
 * Helper function to get user's access level for UI rendering
 */
export function getUserAccessLevel(middlewareContext: Partial<MiddlewareContext>) {
  if (!middlewareContext.auth) {
    return 'none';
  }

  if (middlewareContext.auth.isOwner) return 'owner';
  if (middlewareContext.auth.isAdmin) return 'admin';
  if (middlewareContext.auth.isManager) return 'manager';
  if (middlewareContext.auth.isCoach) return 'coach';
  return 'none';
}

/**
 * Helper function to check if user can perform specific actions
 */
export function canPerformAction(
  middlewareContext: Partial<MiddlewareContext>,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage'
): boolean {
  if (!middlewareContext.auth) return false;

  // Owner can do everything
  if (middlewareContext.auth.isOwner) return true;

  // Admin can do most things within their tenant
  if (middlewareContext.auth.isAdmin) {
    return ['create', 'read', 'update', 'delete', 'manage'].includes(action);
  }

  // Manager has limited access
  if (middlewareContext.auth.isManager) {
    return ['create', 'read', 'update'].includes(action);
  }
  if (middlewareContext.auth.isCoach) {
    return ['create', 'read'].includes(action);
  }
  return false;
}

/**
 * Helper function to get tenant context for API responses
 */
export function getTenantContext(middlewareContext: Partial<MiddlewareContext>) {
  if (!middlewareContext.tenant) {
    return null;
  }

  return {
    tenantId: middlewareContext.tenant.tenant?.id,
    locationId: middlewareContext.tenant.location?.id,
    accessLevel: middlewareContext.tenant.accessLevel,
  };
}

/**
 * Helper function to create audit log context
 */
export function createAuditContext(middlewareContext: Partial<MiddlewareContext>) {
  if (!middlewareContext.auth) {
    return null;
  }

  return {
    userId: middlewareContext.auth.user.id,
    userRole: middlewareContext.auth.user.roleName,
    tenantId: middlewareContext.tenant?.tenant?.id,
    locationId: middlewareContext.tenant?.location?.id,
    timestamp: new Date().toISOString(),
  };
}
