'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  MapPin, 
  Users, 
  UserCheck,
  Loader2,
  Settings,
  BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  academies: number;
  locations: number;
  students: number;
  staff: number;
}

interface DashboardData {
  stats: DashboardStats;
}

export function OwnerDashboard() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['owner-dashboard-stats'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.owner.dashboard);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const stats = [
    {
      title: 'No. of Academies',
      value: data?.stats?.academies ?? 0,
      description: 'Total active academies',
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      href: '/owner/tenant-management',
    },
    {
      title: 'No. of Locations',
      value: data?.stats?.locations ?? 0,
      description: 'Total active locations',
      icon: MapPin,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
      href: '/owner/tenant-management',
    },
    {
      title: 'No. of Students',
      value: data?.stats?.students ?? 0,
      description: 'Total students across all academies',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
      href: '/owner/students',
    },
    {
      title: 'No. of Staff',
      value: data?.stats?.staff ?? 0,
      description: 'Total active staff members',
      icon: UserCheck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
      href: '/owner/user-management/users',
    },
  ];

  const quickActions = [
    {
      title: 'Manage Academies',
      description: 'View and manage all academies',
      icon: Building2,
      href: '/owner/tenant-management',
    },
    {
      title: 'View Students',
      description: 'Browse all students',
      icon: Users,
      href: '/owner/students',
    },
    {
      title: 'Reports',
      description: 'View analytics and reports',
      icon: BarChart3,
      href: '/owner/reports',
    },
    {
      title: 'User Management',
      description: 'Manage users and permissions',
      icon: Settings,
      href: '/owner/user-management/users',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Dashboard</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Failed to load dashboard data'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Owner Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Overview of all academies, locations, students, and staff
          </p>
        </div>
        <Badge variant="primary" className="text-sm">
          Owner
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="hover:shadow-lg transition-shadow cursor-pointer p-1"
              onClick={() => stat.href && router.push(stat.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="p-1">
        <CardHeader className="px-4 pt-4">
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-start hover:bg-accent"
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
    </div>
  );
}

