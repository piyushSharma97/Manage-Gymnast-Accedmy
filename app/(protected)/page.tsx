'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/providers/settings-provider';
import { useTenant } from '@/hooks/use-tenant';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { TenantDashboard } from '@/components/tenant/tenant-dashboard';
import { ScreenLoader } from '@/components/common/screen-loader';

export default function Page() {
  const { settings } = useSettings();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isAdmin,isManager,isOwner } = useTenant();
  const isParent = session?.user?.roleSlug === 'parent' || session?.user?.roleSlug === 'guardian';

  useEffect(() => {
    if (isManager) {
        router.push('/manager/dashboard');
      } else if (isAdmin) {
        router.push('/admin/dashboard/batch');
      } else if (isOwner) {
        router.push('/owner');
      } else if (isParent) {
        router.push('/parent');
      }
  }, [status, isAdmin, router, isOwner, isManager, isParent]);

  if (status === 'loading') {
    return <ScreenLoader />;
  }

  if (status === 'authenticated' && (isAdmin || isManager || isOwner || isParent)) {
    return <ScreenLoader />;
  }

  if (settings?.layout === 'demo1') {
    return (
      <>
        <Container>
          <Toolbar>
            <ToolbarHeading
              title="Dashboard"
              description="Overview of your academy"
            />
            <ToolbarActions></ToolbarActions>
          </Toolbar>
        </Container>
        <Container>
          <TenantDashboard />
        </Container>
      </>
    );
  }
}