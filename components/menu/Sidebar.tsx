import React from 'react';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { RoleBasedMenu, PathAccess, RoleAccess } from '@/components/menu/RoleBasedMenu';
import { User } from '@/utils/menuUtils';
import type { UserRole } from '@/constants/roles';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  user: User | null;
  tenantContext?: { tenantId?: number; locationId?: number };
  currentPath?: string;
}

export function Sidebar({ user, tenantContext, currentPath }: SidebarProps) {
  const router = useRouter();

  const handleItemClick = (item: { path?: string }) => {
    if (item.path) {
      router.push(item.path);
    }
  };

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* User Info */}
      <div className="p-4 border-b border-gray-200">
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
              <div className="flex space-x-1 mt-1">
                {user.roles.map((role, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-500">Not signed in</p>
          </div>
        )}
      </div>

      {/* Tenant/Location Context */}
      {tenantContext && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Context
          </div>
          {tenantContext.tenantId && (
            <div className="text-sm text-gray-700">
              Tenant ID: {tenantContext.tenantId}
            </div>
          )}
          {tenantContext.locationId && (
            <div className="text-sm text-gray-700">
              Location ID: {tenantContext.locationId}
            </div>
          )}
        </div>
      )}

      {/* Role-based Menu */}
      <div className="flex-1 overflow-y-auto">
        <RoleBasedMenu
          menu={MENU_SIDEBAR}
          user={user}
          tenantContext={tenantContext}
          currentPath={currentPath}
          onItemClick={handleItemClick}
          className="p-4"
        />
      </div>

      {/* Footer with role-specific actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <RoleAccess user={user} roles={['owner', 'admin']}>
          <button className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Admin Settings
          </button>
        </RoleAccess>
        
        <RoleAccess user={user} roles={['manager']}>
          <button className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 mt-2">
            Manager Tools
          </button>
        </RoleAccess>
      </div>
    </div>
  );
}

// Example usage component
export function MenuExample() {
  // Mock user data for demonstration
  const mockUsers: Record<string, User> = {
    owner: {
      id: '1',
      name: 'John Owner',
      email: 'owner@example.com',
      roles: ['owner' as UserRole],
      tenantId: 1,
      locationId: 1
    },
    admin: {
      id: '2',
      name: 'Jane Admin',
      email: 'admin@example.com',
      roles: ['admin' as UserRole],
      tenantId: 1,
      locationId: 1
    },
    manager: {
      id: '3',
      name: 'Bob Manager',
      email: 'manager@example.com',
      roles: ['manager' as UserRole],
      tenantId: 1,
      locationId: 1
    },
    staff: {
      id: '4',
      name: 'Alice Staff',
      email: 'staff@example.com',
      roles: ['staff' as UserRole],
      tenantId: 1,
      locationId: 1
    }
  };

  const [currentUser, setCurrentUser] = React.useState<User | null>(mockUsers.owner);
  const [currentPath] = React.useState('/admin/dashboard/batch');

  return (
    <div className="flex h-screen">
      <Sidebar
        user={currentUser}
        tenantContext={{ tenantId: 1, locationId: 1 }}
        currentPath={currentPath}
      />
      
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Role-Based Menu System Demo
          </h1>
          
          {/* User Switcher */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Switch User Role</h2>
            <div className="flex space-x-2">
              {Object.entries(mockUsers).map(([role, user]) => (
                <button
                  key={role}
                  onClick={() => setCurrentUser(user)}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    currentUser?.id === user.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Path Access Examples */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Path Access Examples</h2>
            <div className="space-y-2">
              <PathAccess
                user={currentUser}
                path="/owner/tenant-management"
                menu={MENU_SIDEBAR}
              >
                <div className="p-2 bg-green-100 text-green-800 rounded">
                  ✓ Can access Tenant Management
                </div>
              </PathAccess>
              
              <PathAccess
                user={currentUser}
                path="/admin/location"
                menu={MENU_SIDEBAR}
              >
                <div className="p-2 bg-green-100 text-green-800 rounded">
                  ✓ Can access Location Management
                </div>
              </PathAccess>
              
              <PathAccess
                user={currentUser}
                path="/user-management/roles"
                menu={MENU_SIDEBAR}
              >
                <div className="p-2 bg-green-100 text-green-800 rounded">
                  ✓ Can access Role Management
                </div>
              </PathAccess>
            </div>
          </div>

          {/* Role Access Examples */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Role Access Examples</h2>
            <div className="space-y-2">
              <RoleAccess user={currentUser} roles={['owner']}>
                <div className="p-2 bg-purple-100 text-purple-800 rounded">
                  ✓ Owner-only content
                </div>
              </RoleAccess>
              
              <RoleAccess user={currentUser} roles={['admin', 'manager']}>
                <div className="p-2 bg-blue-100 text-blue-800 rounded">
                  ✓ Admin/Manager content
                </div>
              </RoleAccess>
              
              <RoleAccess user={currentUser} roles={['staff']}>
                <div className="p-2 bg-green-100 text-green-800 rounded">
                  ✓ Staff content
                </div>
              </RoleAccess>
            </div>
          </div>

          {/* Current User Info */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <h2 className="text-lg font-semibold mb-4">Current User Info</h2>
            <pre className="text-sm text-gray-600 overflow-auto">
              {JSON.stringify(currentUser, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
