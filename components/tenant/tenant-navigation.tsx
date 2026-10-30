'use client';

import { useTenant } from '@/hooks/use-tenant';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  MapPin, 
  Users, 
  Settings, 
  Shield, 
  BarChart3,
  Calendar,
  UserCheck
} from 'lucide-react';

export function TenantNavigation() {
  const { tenant, location, isOwner, isAdmin, isManager } = useTenant();
  const { canManageUsers, canManageSettings } = usePermissions();
  const router = useRouter();

  const navigationItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      show: true,
    },
    {
      title: 'Students',
      href: '/gymnast-management/gymnasts',
      icon: Users,
      show: true,
    },
    {
      title: 'Events',
      href: '/event-management/events',
      icon: Calendar,
      show: true,
    },
    {
      title: 'User Management',
      href: '/user-management/users',
      icon: UserCheck,
      show: canManageUsers,
    },
    {
      title: 'Settings',
      href: '/user-management/settings',
      icon: Settings,
      show: canManageSettings,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tenant Information */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {tenant?.academyName || 'No Tenant'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tenant?.academyCode}
            </p>
          </div>
        </div>
        
        {location && (
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {location.centerName}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {location.centerCode}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Access Level Badge */}
      <div className="flex justify-center">
        <Badge 
          variant={isOwner ? 'default' : isAdmin ? 'secondary' : 'outline'}
          className="text-xs"
        >
          <Shield className="h-3 w-3 mr-1" />
          {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Manager'}
        </Badge>
      </div>

      {/* Navigation Items */}
      <nav className="space-y-1">
        {navigationItems.map((item) => {
          if (!item.show) return null;
          
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => router.push(item.href)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.title}
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
