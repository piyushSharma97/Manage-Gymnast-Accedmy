# Role-Based Menu Filtering System

This document explains how to use the comprehensive role-based menu filtering system implemented for the My Academy application.

## Overview

The role-based menu filtering system ensures that menu items are only visible to users with the appropriate roles and permissions. It supports:

- **Role-based access control** with hierarchical permissions
- **Permission-based filtering** for fine-grained access control
- **Tenant/location context filtering** for multi-tenant applications
- **Comprehensive error handling** and caching
- **Reusable components** for easy integration

## Architecture

### Core Components

1. **`utils/menuUtils.ts`** - Core filtering logic and utilities
2. **`hooks/useMenuAccess.ts`** - React hooks for menu filtering
3. **`components/menu/RoleBasedMenu.tsx`** - Reusable menu components
4. **`config/menu.config.tsx`** - Menu configuration with role definitions
5. **`constants/roles.ts`** - Role definitions and hierarchy

### Role Hierarchy

The system implements a hierarchical role structure:

```
owner (highest)
├── admin
├── manager
├── staff
└── member (lowest)
```

Higher roles inherit permissions from lower roles. For example, an `owner` can access all items that `admin`, `manager`, `staff`, and `member` can access.

## Usage

### Basic Menu Filtering

```tsx
import { useMenuAccess } from '@/hooks/useMenuAccess';
import { MENU_SIDEBAR } from '@/config/menu.config';

function MyComponent({ user }) {
  const filteredMenu = useMenuAccess(user, MENU_SIDEBAR);
  
  return (
    <nav>
      {filteredMenu.map((item, index) => (
        <MenuItem key={index} item={item} />
      ))}
    </nav>
  );
}
```

### Advanced Filtering with Tenant Context

```tsx
import { useMenuAccess } from '@/hooks/useMenuAccess';

function MyComponent({ user, tenantContext }) {
  const filteredMenu = useMenuAccess(user, MENU_SIDEBAR, tenantContext);
  
  return (
    <RoleBasedMenu
      menu={MENU_SIDEBAR}
      user={user}
      tenantContext={tenantContext}
      onItemClick={handleItemClick}
    />
  );
}
```

### Role-Based Conditional Rendering

```tsx
import { RoleAccess } from '@/components/menu/RoleBasedMenu';

function AdminPanel() {
  return (
    <RoleAccess user={user} roles={['owner', 'admin']}>
      <div>Admin-only content</div>
    </RoleAccess>
  );
}
```

### Path Access Checking

```tsx
import { PathAccess } from '@/components/menu/RoleBasedMenu';

function ProtectedPage() {
  return (
    <PathAccess
      user={user}
      path="/admin/settings"
      menu={MENU_SIDEBAR}
    >
      <div>Protected content</div>
    </PathAccess>
  );
}
```

## Menu Configuration

### Basic Menu Item

```tsx
{
  title: 'Dashboard',
  icon: LayoutGrid,
  path: '/admin/dashboard',
  roles: ['admin', 'manager', 'staff']
}
```

### Menu Item with Children

```tsx
{
  title: 'Administration',
  icon: ShieldUser,
  roles: ['owner', 'admin', 'manager'],
  children: [
    {
      title: 'Users',
      path: '/admin/users',
      roles: ['admin', 'manager']
    },
    {
      title: 'Settings',
      path: '/admin/settings',
      roles: ['owner', 'admin']
    }
  ]
}
```

### Advanced Menu Item with Permissions

```tsx
{
  title: 'Advanced Settings',
  path: '/admin/advanced',
  roles: ['admin'],
  permissions: ['settings.write', 'admin.advanced'],
  requiresActiveTenant: true,
  requiresActiveLocation: false
}
```

## API Reference

### `filterMenu(menu, user)`

Filters a menu based on user roles.

**Parameters:**
- `menu: MenuConfig` - The menu configuration to filter
- `user: User | null` - The user object with roles

**Returns:** `MenuConfig` - Filtered menu items

### `filterMenuWithPermissions(menu, user, tenantContext?)`

Enhanced filtering with permissions and tenant/location context.

**Parameters:**
- `menu: MenuConfig` - The menu configuration to filter
- `user: User | null` - The user object with roles and permissions
- `tenantContext?: { tenantId?: number; locationId?: number }` - Optional tenant context

**Returns:** `MenuConfig` - Filtered menu items

### `useMenuAccess(user, baseMenu, tenantContext?)`

React hook for menu filtering with memoization and error handling.

**Parameters:**
- `user: User | null` - The user object
- `baseMenu: MenuConfig` - The base menu configuration
- `tenantContext?: { tenantId?: number; locationId?: number }` - Optional tenant context

**Returns:** `MenuConfig` - Filtered menu items

### `useRoleCheck(user, role)`

Hook to check if user has a specific role.

**Parameters:**
- `user: User | null` - The user object
- `role: string` - The role to check

**Returns:** `boolean` - Whether user has the role

### `usePathAccess(user, path, menu)`

Hook to check if user can access a specific path.

**Parameters:**
- `user: User | null` - The user object
- `path: string` - The path to check
- `menu: MenuConfig` - The menu configuration

**Returns:** `boolean` - Whether user can access the path

## Components

### `RoleBasedMenu`

Main menu component with role-based filtering.

**Props:**
- `menu: MenuConfig` - Menu configuration
- `user: User | null` - User object
- `tenantContext?: { tenantId?: number; locationId?: number }` - Optional tenant context
- `className?: string` - CSS classes
- `onItemClick?: (item: MenuItem) => void` - Click handler
- `currentPath?: string` - Current path for active state

### `RoleAccess`

Conditional rendering component based on user roles.

**Props:**
- `user: User | null` - User object
- `roles: string[]` - Required roles
- `children: React.ReactNode` - Content to render
- `fallback?: React.ReactNode` - Fallback content
- `requireAll?: boolean` - Whether to require all roles (default: false)

### `PathAccess`

Conditional rendering component based on path access.

**Props:**
- `user: User | null` - User object
- `path: string` - Path to check
- `menu: MenuConfig` - Menu configuration
- `children: React.ReactNode` - Content to render
- `fallback?: React.ReactNode` - Fallback content

## Best Practices

### 1. Security-First Approach

Always specify roles for menu items. Items without roles are denied by default:

```tsx
// ✅ Good - explicit roles
{
  title: 'Admin Panel',
  path: '/admin',
  roles: ['admin', 'owner']
}

// ❌ Bad - no roles specified
{
  title: 'Admin Panel',
  path: '/admin'
}
```

### 2. Use Role Hierarchy

Leverage the role hierarchy to avoid redundant role specifications:

```tsx
// ✅ Good - owner can access admin items
{
  title: 'User Management',
  roles: ['admin'] // owner automatically has access
}

// ❌ Redundant - unnecessary role specification
{
  title: 'User Management',
  roles: ['owner', 'admin']
}
```

### 3. Consistent Role Definitions

Use consistent role definitions across all menu items:

```tsx
// ✅ Good - consistent role arrays
roles: ['owner', 'admin', 'manager']

// ❌ Bad - inconsistent formatting
roles: ['owner','admin', 'manager']
```

### 4. Error Handling

Always handle cases where user is null or roles are missing:

```tsx
// ✅ Good - proper null checking
const filteredMenu = useMenuAccess(user, MENU_SIDEBAR);
if (!user) {
  return <div>Please sign in</div>;
}

// ❌ Bad - no null checking
const filteredMenu = useMenuAccess(user, MENU_SIDEBAR);
```

### 5. Performance Optimization

Use memoization for expensive operations:

```tsx
// ✅ Good - memoized filtering
const filteredMenu = useMemo(() => {
  return filterMenu(MENU_SIDEBAR, user);
}, [user]);

// ❌ Bad - filtering on every render
const filteredMenu = filterMenu(MENU_SIDEBAR, user);
```

## Testing

The system includes comprehensive tests in `__tests__/menuFiltering.test.ts`:

```tsx
import { runAllTests } from '@/__tests__/menuFiltering.test';

// Run all tests
runAllTests();
```

Test categories:
- Basic menu filtering
- Path access validation
- Tenant context filtering
- Role hierarchy verification
- Edge case handling

## Migration Guide

### From Old System

If migrating from an older menu system:

1. **Add roles to menu items:**
   ```tsx
   // Old
   { title: 'Dashboard', path: '/dashboard' }
   
   // New
   { title: 'Dashboard', path: '/dashboard', roles: ['admin', 'manager'] }
   ```

2. **Update user interface:**
   ```tsx
   // Old
   interface User {
     id: string;
     name: string;
     email: string;
   }
   
   // New
   interface User {
     id: string;
     name: string;
     email: string;
     roles: UserRole[];
     permissions?: string[];
     tenantId?: number;
     locationId?: number;
   }
   ```

3. **Replace manual filtering:**
   ```tsx
   // Old
   const visibleItems = menuItems.filter(item => 
     user.role === 'admin' || item.public
   );
   
   // New
   const visibleItems = useMenuAccess(user, menuItems);
   ```

## Troubleshooting

### Common Issues

1. **Menu items not showing:**
   - Check if roles are properly defined
   - Verify user has the required roles
   - Ensure role hierarchy is working correctly

2. **Performance issues:**
   - Use memoization with `useMemo`
   - Avoid filtering on every render
   - Consider caching filtered results

3. **Type errors:**
   - Ensure proper TypeScript types are imported
   - Check role definitions match `UserRole` type
   - Verify menu configuration structure

### Debug Mode

Enable debug logging:

```tsx
// Add to your component
useEffect(() => {
  console.log('Filtered menu:', filteredMenu);
  console.log('User roles:', user?.roles);
}, [filteredMenu, user]);
```

## Contributing

When adding new menu items or modifying the filtering system:

1. Update the menu configuration with proper roles
2. Add tests for new functionality
3. Update documentation
4. Ensure backward compatibility
5. Test with different user roles

## Support

For issues or questions about the role-based menu filtering system:

1. Check the test files for examples
2. Review the API documentation
3. Test with different user roles
4. Check console for error messages
