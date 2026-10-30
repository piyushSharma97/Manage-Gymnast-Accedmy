import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

export interface Permission {
  slug: string;
  name: string;
  description?: string;
}

export interface RolePermission {
  role: {
    id: number;
    name: string;
    slug: string;
  };
  permission: Permission;
}

/**
 * Hook to get user permissions from session
 */
export function usePermissions() {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status === 'loading' || !session?.user) {
      return {
        permissions: [],
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasAllPermissions: () => false,
        canPerformAction: () => false,
        canCreate: false,
        canDelete: false,
        canManageUsers: false,
        canManageSettings: false,
      };
    }

    const roleSlug = session.user.roleSlug || '';
    const isOwner = roleSlug === 'owner';
    const isAdmin = roleSlug === 'admin';
    const isManager = roleSlug === 'manager';

    // Owner has all permissions
    const permissions = isOwner ? ['*'] : [];

    return {
      permissions,
      hasPermission: (permission: string) => {
        if (isOwner) return true;
        return permissions.includes(permission);
      },
      hasAnyPermission: (permissions: string[]) => {
        if (isOwner) return true;
        return permissions.some(p => permissions.includes(p));
      },
      hasAllPermissions: (permissions: string[]) => {
        if (isOwner) return true;
        return permissions.every(p => permissions.includes(p));
      },
      canPerformAction: (action: 'create' | 'read' | 'update' | 'delete' | 'manage') => {
        if (isOwner) return true;
        if (isAdmin) return ['create', 'read', 'update', 'delete', 'manage'].includes(action);
        if (isManager) return ['create', 'read', 'update'].includes(action);
        return false;
      },
      canCreate: isOwner || isAdmin || isManager,
      canDelete: isOwner || isAdmin,
      canManageUsers: isOwner || isAdmin,
      canManageSettings: isOwner || isAdmin,
    };
  }, [session, status]);
}

/**
 * Hook to check specific permissions
 */
export function usePermissionCheck(requiredPermissions: string[]) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  return useMemo(() => {
    return {
      hasPermission: (permission: string) => hasPermission(permission),
      hasAnyPermission: () => hasAnyPermission(requiredPermissions),
      hasAllPermissions: () => hasAllPermissions(requiredPermissions),
      missingPermissions: requiredPermissions.filter(p => !hasPermission(p)),
    };
  }, [hasPermission, hasAnyPermission, hasAllPermissions, requiredPermissions]);
}

/**
 * Hook to get role-based access patterns
 */
export function useRoleAccess() {
  const { data: session } = useSession();

  return useMemo(() => {
    if (!session?.user) {
      return {
        isOwner: false,
        isAdmin: false,
        isManager: false,
        accessLevel: 'none' as const,
        canViewAllTenants: false,
        canViewAllLocations: false,
        canManageUsers: false,
        canManageSettings: false,
      };
    }

    const roleSlug = session.user.roleSlug || '';
    const isOwner = roleSlug === 'owner';
    const isAdmin = roleSlug === 'admin';
    const isManager = roleSlug === 'manager';

    return {
      isOwner,
      isAdmin,
      isManager,
      accessLevel: isOwner ? 'owner' : isAdmin ? 'admin' : isManager ? 'manager' : 'none',
      canViewAllTenants: isOwner,
      canViewAllLocations: isOwner || isAdmin,
      canManageUsers: isOwner || isAdmin,
      canManageSettings: isOwner || isAdmin,
    };
  }, [session]);
}

/**
 * Hook to check if user can access specific routes
 */
export function useRouteAccess() {
  const roleAccess = useRoleAccess();

  return useMemo(() => {
    return {
      canAccessOwnerRoutes: roleAccess.isOwner,
      canAccessAdminRoutes: roleAccess.isOwner || roleAccess.isAdmin,
      canAccessManagerRoutes: roleAccess.isOwner || roleAccess.isAdmin || roleAccess.isManager,
      canAccessUserManagement: roleAccess.isOwner || roleAccess.isAdmin,
      canAccessSettings: roleAccess.isOwner || roleAccess.isAdmin,
      canAccessDashboard: roleAccess.isOwner || roleAccess.isAdmin || roleAccess.isManager,
    };
  }, [roleAccess]);
}

/**
 * Hook to get tenant-specific access
 */
export function useTenantAccess() {
  const { data: session } = useSession();

  return useMemo(() => {
    if (!session?.user) {
      return {
        tenantId: null,
        locationId: null,
        canAccessTenant: () => false,
        canAccessLocation: () => false,
        canManageTenant: false,
        canManageLocation: false,
      };
    }

    const tenantId = session.user.tenantId;
    const locationId = session.user.locationId;
    const isOwner = session.user.roleSlug === 'owner';
    const isAdmin = session.user.roleSlug === 'admin';
    const isManager = session.user.roleSlug === 'manager';

    return {
      tenantId,
      locationId,
      canAccessTenant: (targetTenantId: number) => {
        if (isOwner) return true;
        return tenantId === targetTenantId;
      },
      canAccessLocation: (targetLocationId: number, targetTenantId?: number) => {
        if (isOwner) return true;
        if (isAdmin && targetTenantId && tenantId === targetTenantId) return true;
        return locationId === targetLocationId;
      },
      canManageTenant: isOwner || isAdmin,
      canManageLocation: isOwner || isAdmin || isManager,
    };
  }, [session]);
}
