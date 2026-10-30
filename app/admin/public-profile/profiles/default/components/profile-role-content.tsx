'use client';

import Link from 'next/link';
import { Building2, MapPin, Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/hooks/use-tenant';
import { getUserAccountPaths } from '@/lib/user-account-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function roleSummary(roleSlug: string | null | undefined): string {
  switch (roleSlug) {
    case 'admin':
      return 'You manage academy-wide settings, locations, programs, and billing for your organization.';
    case 'manager':
      return 'You manage day-to-day operations for your assigned center, including students, staff, and schedules.';
    case 'coach':
      return 'You work with students, classes, skills assessments, and fitness activities at your center.';
    case 'parent':
    case 'guardian':
      return "You can follow your children's schedules, progress, fees, and messages from the academy.";
    default:
      return 'Your profile is linked to My Academy for your academy.';
  }
}

export function ProfileRoleContent() {
  const { data: session } = useSession();
  const { tenant, location } = useTenant();
  const paths = getUserAccountPaths(session?.user?.roleSlug);
  const roleSlug = session?.user?.roleSlug;
  const sub = roleSummary(roleSlug);

  const tenantLine = tenant?.academyName
    ? `${tenant.academyName}${tenant.academyCode ? ` (${tenant.academyCode})` : ''}`
    : null;

  const locationLine = location
    ? [
        location.centerName,
        [location.city, location.state, location.country].filter(Boolean).join(', '),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:gap-7.5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>About your role</CardTitle>
          <CardDescription>{sub}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {session?.user?.roleName ? (
            <Badge variant="primary" appearance="light">
              {session.user.roleName}
            </Badge>
          ) : null}
          {roleSlug ? (
            <Badge variant="outline" appearance="outline">
              {roleSlug}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4 opacity-70" />
            Account
          </CardTitle>
          <CardDescription>Update photo, name, and password</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="primary" size="sm" className="w-full sm:w-auto" asChild>
            <Link href={paths.myProfile}>Open profile settings</Link>
          </Button>
        </CardContent>
      </Card>

      {tenantLine ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 opacity-70" />
              Academy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {tenantLine}
            {tenant?.subscriptionStatus ? (
              <p className="mt-2 text-xs capitalize">
                Subscription: {String(tenant.subscriptionStatus).replace(/_/g, ' ')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {locationLine ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 opacity-70" />
              Center
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{locationLine}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
