import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    roleId: number;
    roleName: string;
    tenantId?: number;
    locationId?: number;
    status: string;
  };
  isAuthenticated: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCoach?: boolean;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  requireTenant?: boolean;
  requireLocation?: boolean;
}

/**
 * Authentication middleware that validates user session and extracts user context
 */
export async function authMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{ context: AuthContext | null; response: NextResponse | null }> {
  const {
    requireAuth = true,
    allowedRoles = [],
    requireTenant = false,
    requireLocation = false,
  } = options;

  try {
    // Get session from NextAuth
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      if (requireAuth) {
        return {
          context: null,
          response: NextResponse.json(
            { message: 'Authentication required' },
            { status: 401 }
          ),
        };
      }
      return { context: null, response: null };
    }

    // Get token for additional context
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    // Fetch full user data with role and tenant information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
            isActive: true,
          },
        },
        location: {
          select: {
            id: true,
            centerName: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        ),
      };
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'Account is not active' },
          { status: 403 }
        ),
      };
    }

    // Check tenant requirement
    if (requireTenant && !user.tenantId) {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'Tenant access required' },
          { status: 403 }
        ),
      };
    }

    // Check location requirement
    if (requireLocation && !user.locationId) {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'Location access required' },
          { status: 403 }
        ),
      };
    }

    // Check role requirements
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role.slug)) {
      return {
        context: null,
        response: NextResponse.json(
          { message: 'Insufficient permissions' },
          { status: 403 }
        ),
      };
    }

    // Determine role-based access
    const isOwner = user.role.slug === 'owner';
    const isAdmin = user.role.slug === 'admin';
    const isManager = user.role.slug === 'manager';
    const isCoach = user.role.slug === 'coach';
    const authContext: AuthContext = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || 'Unknown',
        roleId: user.roleId,
        roleName: user.role.name,
        tenantId: user.tenantId || undefined,
        locationId: user.locationId || undefined,
        status: user.status,
      },
      isAuthenticated: true,
      isOwner,
      isAdmin,
      isManager,
      isCoach,
    };

    return { context: authContext, response: null };
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      context: null,
      response: NextResponse.json(
        { message: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Helper function to check if user has required role
 */
export function hasRole(context: AuthContext, requiredRole: string): boolean {
  if (context.isOwner) return true; // Owner has access to everything
  
  switch (requiredRole) {
    case 'owner':
      return context.isOwner;
    case 'admin':
      return context.isAdmin || context.isOwner;
    case 'manager':
      return context.isManager || context.isAdmin || context.isOwner;
    case 'coach':
      return context.isCoach || context.isManager || context.isAdmin || context.isOwner;  
    default:
      return false;
  }
}

/**
 * Helper function to check if user has access to specific tenant
 */
export function hasTenantAccess(context: AuthContext, tenantId: number): boolean {
  if (context.isOwner) return true; // Owner can access all tenants
  return context.user.tenantId === tenantId;
}

/**
 * Helper function to check if user has access to specific location
 */
export function hasLocationAccess(context: AuthContext, locationId: number, tenantId?: number): boolean {
  if (context.isOwner) return true; // Owner can access all locations
  if (context.isAdmin && tenantId && context.user.tenantId === tenantId) return true; // Admin can access all locations in their tenant
  return context.user.locationId === locationId;
}
