'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { SidebarHeader } from './sidebar-header';
import { SidebarMenu } from './sidebar-menu';
import type { UserRole } from '@/constants/roles';
import { User } from '@/utils/menuUtils';

export function Sidebar() {
  const { settings } = useSettings();
  const pathname = usePathname();
  const { data: session } = useSession();

  // Convert NextAuth session to User format for menu system
  const user: User | null = session?.user ? {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    roles: session.user.roleSlug ? [session.user.roleSlug as UserRole] : [],
    permissions: [], // Add permissions if needed
    tenantId: session.user.tenantId || undefined,
    locationId: session.user.locationId || undefined,
  } : null;

  // Create tenant context from session
  const tenantContext = {
    tenantId: session?.user?.tenantId || undefined,
    locationId: session?.user?.locationId || undefined,
  };

  return (
    <div
      className={cn(
        'sidebar bg-background lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-20 lg:flex flex-col items-stretch shrink-0',
        (settings.layouts.demo1.sidebarTheme === 'dark' ||
          pathname.includes('dark-sidebar')) &&
          'dark',
      )}
    >
      <SidebarHeader />
      <div className="overflow-hidden">
        <div className="w-(--sidebar-default-width)">
          <SidebarMenu user={user} tenantContext={tenantContext} />
        </div>
      </div>
    </div>
  );
}
