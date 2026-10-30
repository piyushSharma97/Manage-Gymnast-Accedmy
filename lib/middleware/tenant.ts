import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthContext } from './auth';

export interface TenantContext {
  tenant: {
    id: number;
    academyName: string;
    academyCode: string;
    isActive: boolean;
    subscriptionStatus: string;
  } | null;
  location: {
    id: number;
    centerName: string;
    centerCode: string;
    isActive: boolean;
  } | null;
  hasAccess: boolean;
  accessLevel: 'owner' | 'admin' | 'manager' | 'coach' | 'none';
}

export interface TenantMiddlewareOptions {
  requireActiveTenant?: boolean;
  requireActiveLocation?: boolean;
  allowOwnerAccess?: boolean;
}

/**
 * Multi-tenant middleware that validates tenant access and provides tenant context
 */
export async function tenantMiddleware(
  request: NextRequest,
  authContext: AuthContext,
  options: TenantMiddlewareOptions = {}
): Promise<{ context: TenantContext | null; response: NextResponse | null }> {
  const {
    requireActiveTenant = true,
    requireActiveLocation = false,
    allowOwnerAccess = true,
  } = options;

  try {
    // Owner access - can access all tenants
    if (authContext.isOwner && allowOwnerAccess) {
      // Extract tenant from URL or query params for owner access
      const url = new URL(request.url);
      const tenantId = url.searchParams.get('tenantId') || 
                      url.pathname.match(/\/tenant\/(\d+)/)?.[1];
      
      let tenant = null;
      let location = null;

      if (tenantId) {
        tenant = await prisma.tenant.findUnique({
          where: { id: parseInt(tenantId) },
          select: {
            id: true,
            academyName: true,
            academyCode: true,
            isActive: true,
            subscriptionStatus: true,
          },
        });

        if (tenant && !tenant.isActive && requireActiveTenant) {
          return {
            context: null,
            response: NextResponse.json(
              { message: 'Tenant is not active' },
              { status: 403 }
            ),
          };
        }

        // Get location if specified
        const locationId = url.searchParams.get('locationId') || 
                          url.pathname.match(/\/location\/(\d+)/)?.[1];
        
        if (locationId) {
          location = await prisma.location.findUnique({
            where: { 
              id: parseInt(locationId),
              tenantId: tenant?.id,
            },
            select: {
              id: true,
              centerName: true,
              centerCode: true,
              isActive: true,
            },
          });

          if (location && !location.isActive && requireActiveLocation) {
            return {
              context: null,
              response: NextResponse.json(
                { message: 'Location is not active' },
                { status: 403 }
              ),
            };
          }
        }
      }

      return {
        context: {
          tenant,
          location,
          hasAccess: true,
          accessLevel: 'owner',
        },
        response: null,
      };
    }

    // Admin access - can access their tenant and all locations within it
    if (authContext.isAdmin && authContext.user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: authContext.user.tenantId },
        select: {
          id: true,
          academyName: true,
          academyCode: true,
          isActive: true,
          subscriptionStatus: true,
        },
      });

      if (!tenant) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Tenant not found' },
            { status: 404 }
          ),
        };
      }

      if (!tenant.isActive && requireActiveTenant) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Tenant is not active' },
            { status: 403 }
          ),
        };
      }

      // Get location if user has one assigned
      let location = null;
      if (authContext.user.locationId) {
        location = await prisma.location.findUnique({
          where: { 
            id: authContext.user.locationId,
            tenantId: tenant.id,
          },
          select: {
            id: true,
            centerName: true,
            centerCode: true,
            isActive: true,
          },
        });

        if (location && !location.isActive && requireActiveLocation) {
          return {
            context: null,
            response: NextResponse.json(
              { message: 'Location is not active' },
              { status: 403 }
            ),
          };
        }
      }

      return {
        context: {
          tenant,
          location,
          hasAccess: true,
          accessLevel: 'admin',
        },
        response: null,
      };
    }

    // Manager access - can only access their specific location
    if (authContext.isManager && authContext.user.tenantId && authContext.user.locationId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: authContext.user.tenantId },
        select: {
          id: true,
          academyName: true,
          academyCode: true,
          isActive: true,
          subscriptionStatus: true,
        },
      });

      if (!tenant) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Tenant not found' },
            { status: 404 }
          ),
        };
      }

      if (!tenant.isActive && requireActiveTenant) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Tenant is not active' },
            { status: 403 }
          ),
        };
      }

      const location = await prisma.location.findUnique({
        where: { 
          id: authContext.user.locationId,
          tenantId: tenant.id,
        },
        select: {
          id: true,
          centerName: true,
          centerCode: true,
          isActive: true,
        },
      });

      if (!location) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Location not found' },
            { status: 404 }
          ),
        };
      }

      if (!location.isActive && requireActiveLocation) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Location is not active' },
            { status: 403 }
          ),
        };
      }

      return {
        context: {
          tenant,
          location,
          hasAccess: true,
          accessLevel: 'manager',
        },
        response: null,
      };
    }

    // No access
    return {
      context: {
        tenant: null,
        location: null,
        hasAccess: false,
        accessLevel: 'none',
      },
      response: NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      ),
    };
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return {
      context: null,
      response: NextResponse.json(
        { message: 'Tenant validation error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Helper function to get tenant filter for database queries
 */
export function getTenantFilter(tenantContext: TenantContext, authContext: AuthContext) {
  if (authContext.isOwner) {
    // Owner can access all data, but may want to filter by specific tenant
    return tenantContext.tenant ? { tenantId: tenantContext.tenant.id } : {};
  }
  
  if (authContext.isAdmin && tenantContext.tenant) {
    return { tenantId: tenantContext.tenant.id };
  }
  
  if (authContext.isManager && tenantContext.tenant && tenantContext.location) {
    return { 
      tenantId: tenantContext.tenant.id,
      locationId: tenantContext.location.id,
    };
  }
  
  return {};
}

/**
 * Helper function to get location filter for database queries
 */
export function getLocationFilter(tenantContext: TenantContext, authContext: AuthContext) {
  if (authContext.isOwner) {
    // Owner can access all data, but may want to filter by specific location
    return tenantContext.location ? { locationId: tenantContext.location.id } : {};
  }
  
  if (authContext.isAdmin && tenantContext.tenant) {
    // Admin can access all locations in their tenant
    return { tenantId: tenantContext.tenant.id };
  }
  
  if (authContext.isManager && tenantContext.location) {
    return { 
      tenantId: tenantContext.tenant?.id,
      locationId: tenantContext.location.id,
    };
  }
  
  return {};
}

/**
 * Helper function to validate tenant access for specific tenant ID
 */
export function validateTenantAccess(
  tenantContext: TenantContext,
  authContext: AuthContext,
  requestedTenantId: number
): boolean {
  if (authContext.isOwner) return true;
  return tenantContext.tenant?.id === requestedTenantId;
}

/**
 * Helper function to validate location access for specific location ID
 */
export function validateLocationAccess(
  tenantContext: TenantContext,
  authContext: AuthContext,
  requestedLocationId: number
): boolean {
  if (authContext.isOwner) return true;
  if (authContext.isAdmin && tenantContext.tenant) return true;
  return tenantContext.location?.id === requestedLocationId;
}
