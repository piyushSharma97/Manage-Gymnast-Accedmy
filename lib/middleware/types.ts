import { NextRequest, NextResponse } from 'next/server';
import { AuthContext } from './auth';
import { TenantContext } from './tenant';
import { PermissionContext } from './permissions';

/**
 * Combined middleware context containing all middleware results
 */
export interface MiddlewareContext {
  auth: AuthContext;
  tenant: TenantContext;
  permissions: PermissionContext;
  request: NextRequest;
}

/**
 * Middleware configuration options
 */
export interface MiddlewareConfig {
  auth: {
    requireAuth?: boolean;
    allowedRoles?: string[];
    requireTenant?: boolean;
    requireLocation?: boolean;
  };
  tenant: {
    requireActiveTenant?: boolean;
    requireActiveLocation?: boolean;
    allowOwnerAccess?: boolean;
  };
  permissions: {
    requiredPermissions?: string[];
    requireAllPermissions?: boolean;
    allowOwnerBypass?: boolean;
  };
}

/**
 * Middleware result type
 */
export interface MiddlewareResult {
  success: boolean;
  context?: MiddlewareContext;
  response?: NextResponse;
  error?: string;
}

/**
 * Route protection configuration
 */
export interface RouteProtection {
  path: string;
  methods?: string[];
  auth: {
    requireAuth: boolean;
    allowedRoles?: string[];
    requireTenant?: boolean;
    requireLocation?: boolean;
  };
  tenant: {
    requireActiveTenant?: boolean;
    requireActiveLocation?: boolean;
    allowOwnerAccess?: boolean;
  };
  permissions: {
    requiredPermissions?: string[];
    requireAllPermissions?: boolean;
    allowOwnerBypass?: boolean;
  };
}

/**
 * Predefined route protection configurations
 */
export const ROUTE_PROTECTIONS: Record<string, RouteProtection> = {
  // Owner routes - highest level access
  owner: {
    path: '/owner/**',
    auth: {
      requireAuth: true,
      allowedRoles: ['owner'],
    },
    tenant: {
      allowOwnerAccess: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  
  // Admin routes - tenant level access
  admin: {
    path: '/admin/**',
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin'],
      requireTenant: true,
    },
    tenant: {
      requireActiveTenant: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  
  // Manager routes - location level access
  manager: {
    path: '/manager/**',
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin', 'manager'],
      requireTenant: true,
      requireLocation: true,
    },
    tenant: {
      requireActiveTenant: true,
      requireActiveLocation: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
   // Coach routes - location level access, read-only
  coach: {
    path: '/coach/**',
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin', 'manager', 'coach'],
      requireTenant: true,
      requireLocation: true,
    },
    tenant: {
      requireActiveTenant: true,
      requireActiveLocation: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  // API routes with different protection levels
  'api-owner': {
    path: '/api/owner/**',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    auth: {
      requireAuth: true,
      allowedRoles: ['owner'],
    },
    tenant: {
      allowOwnerAccess: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  
  'api-admin': {
    path: '/api/admin/**',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin'],
      requireTenant: true,
    },
    tenant: {
      requireActiveTenant: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  
  'api-manager': {
    path: '/api/manager/**',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin', 'manager'],
      requireTenant: true,
      requireLocation: true,
    },
    tenant: {
      requireActiveTenant: true,
      requireActiveLocation: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
    'api-coach': {
    path: '/api/coach/**',
    methods: ['GET', 'POST'], // Read-only access
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin', 'manager', 'coach'],
      requireTenant: true,
      requireLocation: true,
    },
    tenant: {
      requireActiveTenant: true,
      requireActiveLocation: true,
    },
    permissions: {
      allowOwnerBypass: true,
    },
  },
  // User management routes
  'api-user-management': {
    path: '/api/user-management/**',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin'],
      requireTenant: true,
    },
    tenant: {
      requireActiveTenant: true,
    },
    permissions: {
      requiredPermissions: ['user.view', 'user.add', 'user.edit', 'user.delete'],
      requireAllPermissions: false,
      allowOwnerBypass: true,
    },
  },
  
  // Dashboard routes
  'api-dashboard': {
    path: '/api/dashboard/**',
    methods: ['GET'],
    auth: {
      requireAuth: true,
      allowedRoles: ['owner', 'admin', 'manager'],
      requireTenant: true,
    },
    tenant: {
      requireActiveTenant: true,
    },
    permissions: {
      requiredPermissions: ['dashboard.view'],
      allowOwnerBypass: true,
    },
  },
};

/**
 * Helper function to get route protection configuration for a given path
 */
export function getRouteProtection(pathname: string): RouteProtection | null {
  for (const [key, config] of Object.entries(ROUTE_PROTECTIONS)) {
    console.log(`Checking route protection for key: ${key}, path: ${config.path}`);
    if (pathname.startsWith(config.path.replace('/**', ''))) {
      return config;
    }
  }
  return null;
}

/**
 * Helper function to check if a route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  const protection = getRouteProtection(pathname);
  return protection?.auth.requireAuth ?? false;
}

/**
 * Helper function to check if a route requires specific role
 */
export function requiresRole(pathname: string, role: string): boolean {
  const protection = getRouteProtection(pathname);
  return protection?.auth.allowedRoles?.includes(role) ?? false;
}

/**
 * Helper function to check if a route requires tenant access
 */
export function requiresTenant(pathname: string): boolean {
  const protection = getRouteProtection(pathname);
  return protection?.auth.requireTenant ?? false;
}

/**
 * Helper function to check if a route requires location access
 */
export function requiresLocation(pathname: string): boolean {
  const protection = getRouteProtection(pathname);
  return protection?.auth.requireLocation ?? false;
}
