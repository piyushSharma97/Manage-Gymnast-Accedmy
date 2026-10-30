import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

export interface TenantInfo {
  id: number;
  academyName: string;
  academyCode: string;
  isActive: boolean;
  subscriptionStatus: string;
}

export interface LocationInfo {
  id: number;
  centerName: string;
  centerCode: string;
  isActive: boolean;
  city?: string;
  state?: string;
  country?: string;
}

export interface TenantContext {
  user: {
    id: string;
    roleSlug: string;
    tenantId?: number;
    locationId?: number;
  };
  tenant?: TenantInfo | null;
  location?: LocationInfo | null;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  accessLevel: 'owner' | 'admin' | 'manager' | 'none';
}

/**
 * Hook to get tenant context from session
 */
export function useTenant(): TenantContext {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status === 'loading' || !session?.user) {
      return {
        user: {
          id: '',
          roleSlug: '',
        },
        tenant: null,
        location: null,
        isOwner: false,
        isAdmin: false,
        isManager: false,
        accessLevel: 'none',
      };
    }

    const roleSlug = session.user.roleSlug || '';
    const isOwner = roleSlug === 'owner';
    const isAdmin = roleSlug === 'admin';
    const isManager = roleSlug === 'manager';

    let accessLevel: 'owner' | 'admin' | 'manager' | 'none' = 'none';
    if (isOwner) accessLevel = 'owner';
    else if (isAdmin) accessLevel = 'admin';
    else if (isManager) accessLevel = 'manager';

    return {
      user: {
        id: session.user.id,
        roleSlug,
        tenantId: session.user.tenantId ?? undefined,
        locationId: session.user.locationId ?? undefined,
      },
      tenant: session.user.tenant,
      location: session.user.location,
      isOwner,
      isAdmin,
      isManager,
      accessLevel,
    };
  }, [session, status]);
}

/**
 * Hook to check if user can perform specific actions
 */
export function usePermissions() {
  const tenantContext = useTenant();

  return useMemo(() => {
    const canCreate = tenantContext.isOwner || tenantContext.isAdmin;
    const canRead = tenantContext.isOwner || tenantContext.isAdmin || tenantContext.isManager;
    const canUpdate = tenantContext.isOwner || tenantContext.isAdmin || tenantContext.isManager;
    const canDelete = tenantContext.isOwner || tenantContext.isAdmin;
    const canManage = tenantContext.isOwner || tenantContext.isAdmin;

    return {
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      canManage,
      canViewAllTenants: tenantContext.isOwner,
      canViewAllLocations: tenantContext.isOwner || tenantContext.isAdmin,
      canManageUsers: tenantContext.isOwner || tenantContext.isAdmin,
      canManageSettings: tenantContext.isOwner || tenantContext.isAdmin,
    };
  }, [tenantContext]);
}

/**
 * Hook to get tenant-aware API parameters
 */
export function useTenantApiParams() {
  const tenantContext = useTenant();

  return useMemo(() => {
    const params: Record<string, any> = {};

    // Add tenant filter for non-owner users
    if (!tenantContext.isOwner && tenantContext.tenant?.id) {
      params.tenantId = tenantContext.tenant.id;
    }

    // Add location filter for managers
    if (tenantContext.isManager && tenantContext.location?.id) {
      params.locationId = tenantContext.location.id;
    }

    return params;
  }, [tenantContext]);
}

/**
 * Hook to get user's display information
 */
export function useUserInfo() {
  const tenantContext = useTenant();

  return useMemo(() => {
    return {
      userId: tenantContext.user.id,
      roleSlug: tenantContext.user.roleSlug,
      tenantName: tenantContext.tenant?.academyName || 'No Tenant',
      locationName: tenantContext.location?.centerName || 'No Location',
      accessLevel: tenantContext.accessLevel,
      isOwner: tenantContext.isOwner,
      isAdmin: tenantContext.isAdmin,
      isManager: tenantContext.isManager,
    };
  }, [tenantContext]);
}

/**
 * Hook to check if user has access to specific resource
 */
export function useResourceAccess() {
  const tenantContext = useTenant();

  return useMemo(() => {
    return {
      canAccessResource: (resourceTenantId?: number, resourceLocationId?: number) => {
        // Owner can access all resources
        if (tenantContext.isOwner) return true;

        // Check tenant access
        if (resourceTenantId && tenantContext.tenant?.id) {
          if (tenantContext.tenant.id !== resourceTenantId) return false;
        }

        // Check location access for managers
        if (tenantContext.isManager && resourceLocationId && tenantContext.location?.id) {
          if (tenantContext.location.id !== resourceLocationId) return false;
        }

        return true;
      },
      canAccessTenant: (tenantId: number) => {
        if (tenantContext.isOwner) return true;
        return tenantContext.tenant?.id === tenantId;
      },
      canAccessLocation: (locationId: number) => {
        if (tenantContext.isOwner) return true;
        if (tenantContext.isAdmin && tenantContext.tenant?.id) return true;
        return tenantContext.location?.id === locationId;
      },
    };
  }, [tenantContext]);
}
