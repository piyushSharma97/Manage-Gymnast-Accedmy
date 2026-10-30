import React, { useMemo } from 'react';
import { MenuConfig, MenuItem } from '@/config/types';
import type { UserRole } from '@/constants/roles';
import { User } from '@/utils/menuUtils';
import { useMenuAccess, usePathAccess } from '@/hooks/useMenuAccess';
import { cn } from '@/lib/utils';

interface RoleBasedMenuProps {
  menu: MenuConfig;
  user: User | null;
  tenantContext?: { tenantId?: number; locationId?: number };
  className?: string;
  onItemClick?: (item: MenuItem) => void;
  currentPath?: string;
}

interface MenuItemComponentProps {
  item: MenuItem;
  user: User | null;
  level?: number;
  onItemClick?: (item: MenuItem) => void;
  currentPath?: string;
}

function MenuItemComponent({ 
  item, 
  user, 
  level = 0, 
  onItemClick, 
  currentPath 
}: MenuItemComponentProps) {
  const isActive = currentPath && item.path ? currentPath.startsWith(item.path) : false;
  const hasChildren = item.children && item.children.length > 0;
  const isHeading = !!item.heading;
  const isSeparator = !!item.separator;

  // Handle special items
  if (isHeading) {
    return (
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {item.title}
      </div>
    );
  }

  if (isSeparator) {
    return <hr className="my-2 border-gray-200" />;
  }

  // Check if user can access this item
  const canAccess = !item.roles || item.roles.length === 0 || 
    user?.roles.some(role => item.roles?.includes(role as UserRole));

  if (!canAccess) {
    return null;
  }

  const handleClick = () => {
    if (onItemClick && item.path) {
      onItemClick(item);
    }
  };

  const baseClasses = cn(
    "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
    "hover:bg-gray-100 hover:text-gray-900",
    isActive && "bg-gray-100 text-gray-900",
    !isActive && "text-gray-700",
    level > 0 && "ml-4"
  );

  return (
    <div>
      <button
        onClick={handleClick}
        className={baseClasses}
        disabled={item.disabled}
      >
        {item.icon && (
          <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
        )}
        <span className="flex-1 text-left">{item.title}</span>
        {item.badge && (
          <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {item.badge}
          </span>
        )}
        {hasChildren && (
          <svg
            className="ml-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </button>
      
      {hasChildren && (
        <div className="mt-1">
          {item.children?.map((child, index) => (
            <MenuItemComponent
              key={index}
              item={child}
              user={user}
              level={level + 1}
              onItemClick={onItemClick}
              currentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RoleBasedMenu({
  menu,
  user,
  tenantContext,
  className,
  onItemClick,
  currentPath
}: RoleBasedMenuProps) {
  const filteredMenu = useMenuAccess(user, menu, tenantContext);

  if (!user) {
    return (
      <div className={cn("p-4", className)}>
        <p className="text-sm text-gray-500">Please sign in to access the menu.</p>
      </div>
    );
  }

  return (
    <nav className={cn("space-y-1", className)}>
      {filteredMenu.map((item, index) => (
        <MenuItemComponent
          key={index}
          item={item}
          user={user}
          onItemClick={onItemClick}
          currentPath={currentPath}
        />
      ))}
    </nav>
  );
}

// Higher-order component for easy integration
export function withRoleBasedMenu<P extends object>(
  Component: React.ComponentType<P>,
  menuConfig: MenuConfig
) {
  return function WrappedComponent(props: P & { user: User | null; tenantContext?: { tenantId?: number; locationId?: number } }) {
    const { user, tenantContext, ...restProps } = props;
    
    return (
      <Component
        {...(restProps as P)}
        menu={<RoleBasedMenu menu={menuConfig} user={user} tenantContext={tenantContext} />}
      />
    );
  };
}

// Utility component for checking access to specific paths
interface PathAccessProps {
  user: User | null;
  path: string;
  menu: MenuConfig;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PathAccess({ user, path, menu, children, fallback = null }: PathAccessProps) {
  const canAccess = usePathAccess(user, path, menu);
  
  return canAccess ? <>{children}</> : <>{fallback}</>;
}

// Utility component for role-based conditional rendering
interface RoleAccessProps {
  user: User | null;
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export function RoleAccess({ user, roles, children, fallback = null, requireAll = false }: RoleAccessProps) {
  const hasAccess = useMemo(() => {
    if (!user?.roles) return false;
    return requireAll
      ? roles.every((role) => user.roles?.includes(role as UserRole))
      : roles.some((role) => user.roles?.includes(role as UserRole));
  }, [user, roles, requireAll]);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
