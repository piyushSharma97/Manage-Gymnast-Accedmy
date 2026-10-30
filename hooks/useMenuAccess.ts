import { useMemo, useCallback } from 'react';
import { MenuConfig } from '@/config/types';
import type { UserRole } from '@/constants/roles';
import { User, filterMenu, filterMenuWithPermissions, canAccessPath } from '@/utils/menuUtils';

// Enhanced hook with better error handling and caching
export function useMenuAccess(
  user: User | null, 
  baseMenu: MenuConfig,
  tenantContext?: { tenantId?: number; locationId?: number }
): MenuConfig {
  return useMemo(() => {
    try {
      if (tenantContext) {
        return filterMenuWithPermissions(baseMenu, user, tenantContext);
      }
      return filterMenu(baseMenu, user);
    } catch (error) {
      console.error('Error filtering menu:', error);
      // Return empty menu on error to prevent crashes
      return [];
    }
  }, [user, baseMenu, tenantContext]);
}

// Hook to check if user has specific role
export function useRoleCheck(user: User | null, role: string): boolean {
  return useMemo(() => {
    return user?.roles.includes(role as UserRole) ?? false;
  }, [user, role]);
}

// Hook to check if user has any of the specified roles
export function useAnyRoleCheck(user: User | null, roles: string[]): boolean {
  return useMemo(() => {
    return user?.roles.some(userRole => roles.includes(userRole)) ?? false;
  }, [user, roles]);
}

// Hook to check if user can access a specific path
export function usePathAccess(user: User | null, path: string, menu: MenuConfig): boolean {
  return useMemo(() => {
    return canAccessPath(user, path, menu);
  }, [user, path, menu]);
}

// Hook to get filtered menu with memoization and error handling
export function useFilteredMenu(
  user: User | null,
  baseMenu: MenuConfig,
  options?: {
    tenantContext?: { tenantId?: number; locationId?: number };
    includeInactive?: boolean;
  }
): {
  menu: MenuConfig;
  isLoading: boolean;
  error: string | null;
} {
  return useMemo(() => {
    try {
      if (!user) {
        return {
          menu: [],
          isLoading: false,
          error: null
        };
      }

      const filteredMenu = options?.tenantContext 
        ? filterMenuWithPermissions(baseMenu, user, options.tenantContext)
        : filterMenu(baseMenu, user);

      return {
        menu: filteredMenu,
        isLoading: false,
        error: null
      };
    } catch (error) {
      console.error('Error in useFilteredMenu:', error);
      return {
        menu: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [user, baseMenu, options?.tenantContext, options?.includeInactive]);
}

// Hook to check multiple permissions at once
export function usePermissionsCheck(user: User | null, permissions: string[]): {
  hasAll: boolean;
  hasAny: boolean;
  missingPermissions: string[];
} {
  return useMemo(() => {
    if (!user?.permissions) {
      return {
        hasAll: false,
        hasAny: false,
        missingPermissions: permissions
      };
    }

    const missingPermissions = permissions.filter(
      permission => !user.permissions?.includes(permission)
    );

    return {
      hasAll: missingPermissions.length === 0,
      hasAny: permissions.some(permission => user.permissions?.includes(permission)),
      missingPermissions
    };
  }, [user, permissions]);
}
