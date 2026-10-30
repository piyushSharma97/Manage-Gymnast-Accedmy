'use client';

import { ReactNode, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSettings } from '@/providers/settings-provider';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { MobileQuickActionsHub } from '@/components/layout/mobile-quick-actions-hub';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';

function Demo1Layout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { settings, setOption } = useSettings();

  useEffect(() => {
    const bodyClass = document.body.classList;

    if (settings.layouts.demo1.sidebarCollapse) {
      bodyClass.add('sidebar-collapse');
    } else {
      bodyClass.remove('sidebar-collapse');
    }
  }, [settings]); // Runs only on settings update

  useEffect(() => {
    // Set current layout
    setOption('layout', 'demo1');
  }, [setOption]);

  useEffect(() => {
    const bodyClass = document.body.classList;

    // Add a class to the body element
    bodyClass.add('demo1');
    bodyClass.add('sidebar-fixed');
    bodyClass.add('header-fixed');

    const timer = setTimeout(() => {
      bodyClass.add('layout-initialized');
    }, 1000); // 1000 milliseconds

    // Remove the class when the component is unmounted
    return () => {
      bodyClass.remove('demo1');
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.remove('header-fixed');
      bodyClass.remove('layout-initialized');
      clearTimeout(timer);
    };
  }, []); // Runs only once on mount

  useEffect(() => {
    const bodyClass = document.body.classList;
    if (isMobile) {
      bodyClass.add('mobile-app-shell');
    } else {
      bodyClass.remove('mobile-app-shell');
    }
    return () => bodyClass.remove('mobile-app-shell');
  }, [isMobile]);

  return (
    <>
      {!isMobile && <Sidebar />}

      <div className="wrapper flex grow flex-col">
        <Header />

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

        {!isMobile && <Footer />}
        {isMobile && <MobileBottomNav />}
      </div>
    </>
  );
}

export default Demo1Layout;
export { Demo1Layout };
