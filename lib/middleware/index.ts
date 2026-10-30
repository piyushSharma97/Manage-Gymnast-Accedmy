import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, AuthContext } from './auth';
import { tenantMiddleware, TenantContext } from './tenant';
import { permissionMiddleware, PermissionContext } from './permissions';
import { 
  MiddlewareContext, 
  MiddlewareConfig, 
  MiddlewareResult,
  getRouteProtection 
} from './types';

/**
 * Main middleware orchestrator that combines all middleware components
 */
export async function executeMiddleware(
  request: NextRequest,
  config: MiddlewareConfig
): Promise<MiddlewareResult> {
  try {
    // Step 1: Authentication middleware
    const { context: authContext, response: authResponse } = await authMiddleware(
      request,
      config.auth
    );

    if (authResponse) {
      return {
        success: false,
        response: authResponse,
        error: 'Authentication failed',
      };
    }

    if (!authContext) {
      return {
        success: false,
        response: NextResponse.json(
          { message: 'Authentication required' },
          { status: 401 }
        ),
        error: 'No authentication context',
      };
    }

    // Step 2: Tenant middleware
    const { context: tenantContext, response: tenantResponse } = await tenantMiddleware(
      request,
      authContext,
      config.tenant
    );

    if (tenantResponse) {
      return {
        success: false,
        response: tenantResponse,
        error: 'Tenant validation failed',
      };
    }

    if (!tenantContext) {
      return {
        success: false,
        response: NextResponse.json(
          { message: 'Tenant access denied' },
          { status: 403 }
        ),
        error: 'No tenant context',
      };
    }

    // Step 3: Permission middleware
    const { context: permissionContext, response: permissionResponse } = await permissionMiddleware(
      request,
      authContext,
      tenantContext,
      config.permissions
    );

    if (permissionResponse) {
      return {
        success: false,
        response: permissionResponse,
        error: 'Permission validation failed',
      };
    }

    if (!permissionContext) {
      return {
        success: false,
        response: NextResponse.json(
          { message: 'Permission denied' },
          { status: 403 }
        ),
        error: 'No permission context',
      };
    }

    // All middleware passed successfully
    const middlewareContext: MiddlewareContext = {
      auth: authContext,
      tenant: tenantContext,
      permissions: permissionContext,
      request,
    };

    return {
      success: true,
      context: middlewareContext,
    };
  } catch (error) {
    console.error('Middleware execution error:', error);
    return {
      success: false,
      response: NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      ),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Simplified middleware for API routes with automatic route protection detection
 */
export async function apiMiddleware(request: NextRequest): Promise<MiddlewareResult> {
  const pathname = request.nextUrl.pathname;
  const routeProtection = getRouteProtection(pathname);

  if (!routeProtection) {
    // No protection required for this route
    return {
      success: true,
    };
  }

  const config: MiddlewareConfig = {
    auth: routeProtection.auth,
    tenant: routeProtection.tenant,
    permissions: routeProtection.permissions,
  };

  return executeMiddleware(request, config);
}

/**
 * Helper function to extract middleware context from request headers
 * This is used by API routes to get the middleware context
 */
export function getMiddlewareContext(request: NextRequest): MiddlewareContext | null {
  // This would typically be set by the middleware in request headers
  // For now, we'll return null and handle this in the Next.js middleware
  return null;
}

/**
 * Helper function to create tenant-aware database filters
 */
export function createTenantFilters(middlewareContext: MiddlewareContext) {
  const { auth, tenant } = middlewareContext;
  
  const filters: { tenantId?: number; locationId?: number } = {};

  // Add tenant filter
  if (tenant.tenant) {
    filters.tenantId = tenant.tenant.id;
  }

  // Add location filter for managers
  if (auth.isManager && tenant.location) {
    filters.locationId = tenant.location.id;
  }

  return filters;
}

/**
 * Helper function to validate resource access
 */
export function validateResourceAccess(
  middlewareContext: MiddlewareContext,
  resourceTenantId?: number,
  resourceLocationId?: number
): boolean {
  const { auth, tenant } = middlewareContext;

  // Owner can access all resources
  if (auth.isOwner) return true;

  // Check tenant access
  if (resourceTenantId && tenant.tenant) {
    if (tenant.tenant.id !== resourceTenantId) return false;
  }

  // Check location access for managers
  if (auth.isManager && resourceLocationId && tenant.location) {
    if (tenant.location.id !== resourceLocationId) return false;
  }

  return true;
}

// Re-export all middleware components and types
export * from './auth';
export * from './tenant';
export * from './permissions';
export * from './types';
