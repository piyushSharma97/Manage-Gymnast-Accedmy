import { MenuConfig, MenuItem } from '@/config/types';
import { UserRole, ROLE_HIERARCHY, hasAnyRoleAccess } from '@/constants/roles';

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  permissions?: string[]; // Optional permissions for fine-grained access control
  tenantId?: number;
  locationId?: number;
}

// Enhanced menu item interface for better type safety
export interface EnhancedMenuItem extends MenuItem {
  roles?: UserRole[];
  permissions?: string[];
  requiresActiveTenant?: boolean;
  requiresActiveLocation?: boolean;
  strictRoleMatch?: boolean;
}

// Filter menu items based on user roles with enhanced logic
export function filterMenuByRoles(menu: MenuConfig, userRoles: UserRole[]): MenuConfig {
  return menu.filter(item => {
    // Handle special items (headings, separators) - always include them
    if (item.heading || item.separator) {
      return true;
    }

    // If no roles specified, deny access by default (security-first approach)
    if (!item.roles || item.roles.length === 0) {
      return false;
    }
    
    // Check if user has any of the required roles
    let hasAccess: boolean;
    
    // If strictRoleMatch is true, use exact role matching (no hierarchy)
    if (item.strictRoleMatch) {
      // Strict matching: user must have at least one of the exact required roles
      hasAccess = item.roles.some(requiredRole => 
        userRoles.includes(requiredRole as UserRole)
      );
    } else {
      // Default: use role hierarchy (higher roles can access lower role items)
      hasAccess = hasAnyRoleAccess(userRoles, item.roles as UserRole[]);
    }
    
    if (!hasAccess) {
      return false;
    }
    
    // If item has children, recursively filter them
    if (item.children && item.children.length > 0) {
      const filteredChildren = filterMenuByRoles(item.children, userRoles);
      // Only include the item if it has accessible children
      return filteredChildren.length > 0;
    }
    
    return true;
  }).map(item => {
    // Deep clone the item and filter its children
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: filterMenuByRoles(item.children, userRoles)
      };
    }
    return item;
  });
}

// Enhanced filter function with permission and tenant/location checks
export function filterMenuWithPermissions(
  menu: MenuConfig, 
  user: User | null, 
  tenantContext?: { tenantId?: number; locationId?: number }
): MenuConfig {
  if (!user) {
    // Return minimal menu for unauthenticated users
    return menu.filter(item => 
      item.path === '/signin' || 
      item.path === '/signup' || 
      item.path === '/reset-password' ||
      item.heading || // Keep headings for structure
      item.separator // Keep separators
    );
  }
  
  return menu.filter(item => {
    // Handle special items (headings, separators) - always include them
    if (item.heading || item.separator) {
      return true;
    }

    // Check role-based access
    if (item.roles && item.roles.length > 0) {
      let hasRoleAccess: boolean;
      
      // If strictRoleMatch is true, use exact role matching (no hierarchy)
      if (item.strictRoleMatch) {
        // Strict matching: user must have at least one of the exact required roles
        hasRoleAccess = item.roles.some(requiredRole => 
          user.roles.includes(requiredRole as UserRole)
        );
      } else {
        // Default: use role hierarchy (higher roles can access lower role items)
        hasRoleAccess = hasAnyRoleAccess(user.roles, item.roles as UserRole[]);
      }
      
      if (!hasRoleAccess) {
        return false;
      }
    } else if (!item.heading && !item.separator) {
      // Security-first: if no roles specified and not a special item, deny access
      return false;
    }

    // Check permission-based access (if permissions are specified)
    if (item.permissions && item.permissions.length > 0 && user.permissions) {
      const hasPermissionAccess = item.permissions.some(permission => 
        user.permissions?.includes(permission)
      );
      if (!hasPermissionAccess) {
        return false;
      }
    }

    // Check tenant/location requirements
    if (item.requiresActiveTenant && !tenantContext?.tenantId) {
      return false;
    }

    if (item.requiresActiveLocation && !tenantContext?.locationId) {
      return false;
    }

    // If item has children, recursively filter them
    if (item.children && item.children.length > 0) {
      const filteredChildren = filterMenuWithPermissions(item.children, user, tenantContext);
      return filteredChildren.length > 0;
    }
    
    return true;
  }).map(item => {
    // Deep clone the item and filter its children
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: filterMenuWithPermissions(item.children, user, tenantContext)
      };
    }
    return item;
  });
}

// Main function to filter menu based on user (backward compatibility)
export function filterMenu(menu: MenuConfig, user: User | null): MenuConfig {
  return filterMenuWithPermissions(menu, user);
}

// Helper function to check if user has specific role
export function hasRole(user: User | null, role: UserRole): boolean {
  return user?.roles.includes(role) ?? false;
}

// Helper function to check if user has any of the specified roles
export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  return user?.roles.some(role => roles.includes(role)) ?? false;
}

// Helper function to check if user has specific permission
export function hasPermission(user: User | null, permission: string): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

// Helper function to check if user has any of the specified permissions
export function hasAnyPermission(user: User | null, permissions: string[]): boolean {
  return permissions.some(permission => user?.permissions?.includes(permission)) ?? false;
}

// Helper function to get user's highest role (useful for UI display)
export function getUserHighestRole(user: User | null): UserRole | null {
  if (!user || !user.roles.length) return null;
  
  const roleOrder = ['owner', 'admin', 'manager', 'staff', 'member'];
  return user.roles.reduce((highest, current) => {
    const currentIndex = roleOrder.indexOf(current);
    const highestIndex = roleOrder.indexOf(highest);
    return currentIndex < highestIndex ? current : highest;
  });
}

// Helper function to check if user can access a specific path
export function canAccessPath(user: User | null, path: string, menu: MenuConfig): boolean {
  if (!user) return false;
  
  const findMenuItem = (items: MenuConfig, targetPath: string): MenuItem | null => {
    for (const item of items) {
      if (item.path === targetPath) {
        return item;
      }
      if (item.children) {
        const found = findMenuItem(item.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  };
  
  const menuItem = findMenuItem(menu, path);
  if (!menuItem) return false;
  
  if (menuItem.roles && menuItem.roles.length > 0) {
    // If strictRoleMatch is true, use exact role matching (no hierarchy)
    if (menuItem.strictRoleMatch) {
      return menuItem.roles.some(requiredRole => 
        user.roles.includes(requiredRole as UserRole)
      );
    } else {
      // Default: use role hierarchy
      return hasAnyRoleAccess(user.roles, menuItem.roles as UserRole[]);
    }
  }
  
  // Security-first: if no roles specified, deny access
  return false;
}
