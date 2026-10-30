'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/hooks/use-tenant';
import { API_PATHS } from '@/lib/api-paths';
// import { useRoleAccess } from '@/hooks/use-permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Calendar, 
  ClipboardList,
  UserPlus,
  BookOpen,
  FileText,
  Clock,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  activeStudents: number;
  trialsThisMonth: number;
  newRegistrations: number;
  revenue: number;
  pendingInvoices: number;
  upcomingTrials: number;
  totalStudents: number;
}

interface RecentActivity {
  id: string;
  event: string;
  description: string;
  entityType: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface DashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
}

export function ManagerDashboard() {
  const { tenant, location } = useTenant();
  // const { canManageUsers } = useRoleAccess();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_PATHS.manager.dashboard, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setDashboardData(data);
        } else {
          const errorData = await res.json();
          setError(errorData.message || 'Failed to load dashboard data');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // const formatDate = (dateString: string) => {
  //   const date = new Date(dateString);
  //   const now = new Date();
  //   const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
  //   if (diffInSeconds < 60) return 'Just now';
  //   if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  //   if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  //   if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
  //   return date.toLocaleDateString();
  // };

  // const getActivityIcon = (event: string) => {
  //   switch (event.toLowerCase()) {
  //     case 'create':
  //       return '➕';
  //     case 'update':
  //       return '✏️';
  //     case 'delete':
  //       return '🗑️';
  //     default:
  //       return '📝';
  //   }
  // };

  const stats = dashboardData?.stats ? [
    {
      title: 'Active Students',
      value: dashboardData.stats.activeStudents.toLocaleString(),
      description: 'At your location',
      icon: ClipboardList,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Trials Taken',
      value: dashboardData.stats.trialsThisMonth.toLocaleString(),
      description: 'This month',
      icon: UserPlus,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'New Registrations',
      value: dashboardData.stats.newRegistrations.toLocaleString(),
      description: 'This month',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
  ] : [];

  const quickActions = [
    {
      title: 'Manage Trials',
      description: 'View and manage trial sessions',
      icon: Calendar,
      href: '/manager/gymnast-management/trial',
      show: true,
    },
    {
      title: 'Manage Students',
      description: 'View and manage students',
      icon: Users,
      href: '/manager/gymnast-management/students',
      show: true,
    },
    {
      title: 'Manage Batches',
      description: 'View and manage batches',
      icon: BookOpen,
      href: '/manager/gymnast-management/batch',
      show: true,
    },
    {
      title: 'View Attendance',
      description: 'Track student attendance',
      icon: ClipboardList,
      href: '/manager/gymnast-management/attendance',
      show: true,
    },
    {
      title: 'Fees & Payments',
      description: 'Manage invoices and payments',
      icon: undefined,
      href: '/manager/fees/invoice',
      show: true,
    },
  ];

  if (loading) {
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
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="text-destructive text-sm">{error}</div>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {tenant?.academyName} {location && `- ${location.centerName}`}
          </p>
        </div>
        <Badge 
          variant="outline"
          className="text-sm"
        >
          Manager
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bgColor} rounded-full -mr-16 -mt-16 opacity-50`}></div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Stats Row */}
      {dashboardData?.stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.stats.totalStudents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All students at location</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.stats.pendingInvoices.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Trials</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.stats.upcomingTrials.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </CardContent>
          </Card>
        </div>
      )}

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
                  {Icon && <Icon className="h-6 w-6 mb-2" />}
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

