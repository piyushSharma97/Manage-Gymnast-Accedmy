'use client';

import { TenantDashboard } from '@/components/tenant/tenant-dashboard';
import { TenantNavigation } from '@/components/tenant/tenant-navigation';
import { TenantHeader } from '@/components/tenant/tenant-header';
import { TenantSwitcher } from '@/components/tenant/tenant-switcher';
import { TenantUserList } from '@/components/tenant/tenant-user-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/use-tenant';
import { usePermissions } from '@/hooks/use-permissions';

export default function TenantDemoPage() {
  const { tenant, location, isOwner, isAdmin, isManager } = useTenant();
  const { canCreate, canDelete, canManageUsers } = usePermissions();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <TenantHeader />
      
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r p-4">
          <TenantNavigation />
          
          {/* Tenant Switcher for Owners */}
          {isOwner && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Switch Tenant
              </h3>
              <TenantSwitcher />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Multi-Tenant SaaS Demo
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                This page demonstrates the complete multi-tenant functionality.
              </p>
            </div>

            {/* Tenant Information Card */}
            <Card>
              <CardHeader>
                <CardTitle>Current Tenant Context</CardTitle>
                <CardDescription>
                  Information about your current tenant and access level
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Tenant Information</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-medium">{tenant?.academyName || 'No Tenant'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Code:</span>
                        <span className="font-medium">{tenant?.academyCode || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                        <Badge variant={tenant?.isActive ? 'default' : 'secondary'}>
                          {tenant?.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Location Information</h4>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Name:</span>
                        <span className="font-medium">{location?.centerName || 'No Location'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Code:</span>
                        <span className="font-medium">{location?.centerCode || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                        <Badge variant={location?.isActive ? 'default' : 'secondary'}>
                          {location?.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Access Level</h4>
                  <div className="flex items-center gap-4">
                    <Badge variant={isOwner ? 'default' : isAdmin ? 'secondary' : 'outline'}>
                      {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Manager'}
                    </Badge>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {isOwner && 'Full system access'}
                      {isAdmin && 'Tenant-level access'}
                      {isManager && 'Location-level access'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Your Permissions</CardTitle>
                <CardDescription>
                  What you can do based on your role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${canCreate ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="text-sm font-medium">Create</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {canCreate ? 'Allowed' : 'Not allowed'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${canDelete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="text-sm font-medium">Delete</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {canDelete ? 'Allowed' : 'Not allowed'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${canManageUsers ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="text-sm font-medium">Manage Users</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {canManageUsers ? 'Allowed' : 'Not allowed'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${isOwner ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <div className="text-sm font-medium">System Admin</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {isOwner ? 'Allowed' : 'Not allowed'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dashboard */}
            <TenantDashboard />

            {/* User List */}
            {canManageUsers && <TenantUserList />}
          </div>
        </div>
      </div>
    </div>
  );
}
