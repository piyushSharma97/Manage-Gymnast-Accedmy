'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/providers/settings-provider';
import { ScreenLoader } from '@/components/common/screen-loader';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { MobileQuickActionsHub } from '@/components/layout/mobile-quick-actions-hub';
import { Sidebar } from '@/app/components/layouts/demo1/components/sidebar';
import { ParentSelectedStudentProvider } from '@/components/providers/parent-selected-student-provider';
import { ParentHeader } from './components/parent-header';

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { settings, setOption } = useSettings();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/signin');
    }
  }, [status, router]);

  useEffect(() => {
    setOption('layout', 'demo1');
  }, [setOption]);

  useEffect(() => {
    const bodyClass = document.body.classList;
    bodyClass.add('demo1');
    bodyClass.add('sidebar-fixed');
    bodyClass.add('header-fixed');
    if (settings.layouts.demo1.sidebarCollapse) {
      bodyClass.add('sidebar-collapse');
    } else {
      bodyClass.remove('sidebar-collapse');
    }
    const timer = setTimeout(() => bodyClass.add('layout-initialized'), 1000);
    return () => {
      bodyClass.remove('demo1');
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.remove('header-fixed');
      bodyClass.remove('layout-initialized');
      clearTimeout(timer);
    };
  }, [settings.layouts.demo1.sidebarCollapse]);

  useEffect(() => {
    const bodyClass = document.body.classList;
    if (isMobile) {
      bodyClass.add('mobile-app-shell');
    } else {
      bodyClass.remove('mobile-app-shell');
    }
    return () => bodyClass.remove('mobile-app-shell');
  }, [isMobile]);

  if (status === 'loading') {
    return <ScreenLoader />;
  }

  const isParent =
    session?.user?.roleSlug === 'parent' || session?.user?.roleSlug === 'guardian';
  if (status === 'authenticated' && !isParent) {
    router.replace('/');
    return <ScreenLoader />;
  }

  if (!session) {
    return null;
  }

  return (
    <ParentSelectedStudentProvider>
      {!isMobile && <Sidebar />}
      <div className="wrapper flex grow flex-col">
        <ParentHeader />
        <main
          className={
            isMobile
              ? 'grow min-w-0 pt-3 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] sm:pt-4'
              : 'grow pt-4 sm:pt-5 min-w-0'
          }
        >
          {isMobile && <MobileQuickActionsHub />}
          {children}
        </main>
        {isMobile && <MobileBottomNav />}
      </div>
    </ParentSelectedStudentProvider>
  );
}
