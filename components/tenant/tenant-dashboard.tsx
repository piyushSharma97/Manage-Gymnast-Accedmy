'use client';

import { useTenant } from '@/hooks/use-tenant';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  Building2, 
  MapPin, 
  TrendingUp,
  UserCheck,
  Settings,
  BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export function TenantDashboard() {
  const { tenant, location, isOwner, isAdmin, isManager } = useTenant();
  const { canManageUsers, canManageSettings } = usePermissions();
  const router = useRouter();

  const stats = [
    {
      title: 'Total Academies',
      value: '0', // This would come from API
      description: 'All tenants',
      icon: Calendar,
      color: 'text-green-600',
    },
    {
      title: 'Total Students',
      value: '0', // This would come from API
      description: 'Active students',
      icon: Users,
      color: 'text-blue-600',
    },    
    {
      title: 'Locations',
      value: isOwner ? 'All' : '1',
      description: isOwner ? 'All tenants' : 'Your location',
      icon: MapPin,
      color: 'text-purple-600',
    },
    {
      title: 'Growth',
      value: '+12%',
      description: 'This month',
      icon: TrendingUp,
      color: 'text-orange-600',
    },
  ];

  const quickActions = [
    {
      title: 'Add Academy',
      description: 'Register a new Academy',
      icon: Users,
      href: '/owner/tenant-management',
      show: true,
    },
    {
      title: 'Create Event',
      description: 'Schedule a new event',
      icon: Calendar,
      href: '/event-management/events',
      show: true,
    },
    {
      title: 'Manage Users',
      description: 'User management',
      icon: UserCheck,
      href: '/user-management/users',
      show: canManageUsers,
    },
    {
      title: 'Settings',
      description: 'System settings',
      icon: Settings,
      href: '/user-management/settings',
      show: canManageSettings,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {tenant?.academyName} {location && `- ${location.centerName}`}
          </p>
        </div>
        <Badge 
          variant={isOwner ? 'default' : isAdmin ? 'secondary' : 'outline'}
          className="text-sm"
        >
          {isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Manager'}
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => {
              if (!action.show) return null;
              
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => router.push(action.href)}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <div className="text-left">
                    <div className="font-medium">{action.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest updates and changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">System initialized</p>
                <p className="text-xs text-muted-foreground">
                  Multi-tenant setup completed
                </p>
              </div>
            </div>
            {/* More activity items would be added here */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
