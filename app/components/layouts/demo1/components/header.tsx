'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FeedbackNotificationsSheet, useFeedbackNotificationsCount } from '@/partials/topbar/feedback-notifications-sheet';
import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
// import { SearchDialog } from '@/partials/dialogs/search/search-dialog';
// import { ChatSheet } from '@/partials/topbar/chat-sheet';
import { Bell, Menu } from 'lucide-react';
// import { Search, MessageCircleMore } from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPosition } from '@/hooks/use-scroll-position';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Container } from '@/components/common/container';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/constants/roles';
import { User } from '@/utils/menuUtils';

import { ThemeToggle } from '@/components/common/theme-toggle';
import { Breadcrumb } from './breadcrumb';
import { MegaMenu } from './mega-menu';

import { SidebarMenu } from './sidebar-menu';
import { getMobileShellConfig } from '@/config/mobile-app-shell.config';
import { useTenant } from '@/hooks/use-tenant';
import { sessionAvatarUrl } from '@/lib/user-account-nav';


export function Header() {
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const feedbackCount = useFeedbackNotificationsCount();

  const pathname = usePathname();
  const mobileMode = useIsMobile();
  const { data: session } = useSession();

  // Convert NextAuth session to User format for mobile sidebar menu
  const user: User | null = session?.user ? {
    id: session.user.id,
    name: session.user.name || '',
    email: session.user.email || '',
    roles: session.user.roleSlug ? [session.user.roleSlug as UserRole] : [],
    permissions: [],
    tenantId: session.user.tenantId || undefined,
    locationId: session.user.locationId || undefined,
  } : null;

  const tenantContext = {
    tenantId: session?.user?.tenantId || undefined,
    locationId: session?.user?.locationId || undefined,
  };

  const scrollPosition = useScrollPosition();
  const headerSticky: boolean = scrollPosition > 0;
  const { tenant, location } = useTenant();
  const mobileShell = getMobileShellConfig(session?.user?.roleSlug ?? undefined);
  const headerAvatarSrc = sessionAvatarUrl(
    session?.user?.avatar,
    toAbsoluteUrl,
  );
  const SuiteIcon = mobileShell.suiteIcon;
  const mobileSubtitle =
    tenant?.academyName ||
    location?.centerName ||
    session?.user?.email ||
    'My Academy';

  // Close sheet when route changes
  useEffect(() => {
    setIsSidebarSheetOpen(false);
  }, [pathname]);

  const mobileMenuSheet = (
    <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          mode="icon"
          className="shrink-0 size-9 text-primary-foreground hover:bg-primary-foreground/15"
          aria-label="Open menu"
        >
          <Menu className="size-5 opacity-95" />
        </Button>
      </SheetTrigger>
      <SheetContent
        className="p-0 gap-0 w-[min(275px,85vw)] sm:w-[275px] max-w-[100vw] flex flex-col h-full"
        side="left"
        close={true}
      >
        <SheetHeader className="p-0 space-y-0 shrink-0" />
        <SheetBody className="p-0 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          <SidebarMenu user={user} tenantContext={tenantContext} />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );

  return (
    <header
      className={cn(
        'header top-0 z-10 start-0 flex items-stretch shrink-0 border-b border-transparent bg-background end-0 pe-[var(--removed-body-scroll-bar-size,0px)]',
        mobileMode ? 'sticky' : 'fixed',
        headerSticky && 'border-b border-border',
        mobileMode && 'items-start lg:items-stretch',
      )}
    >
      <Container
        className={cn(
          'flex justify-between items-stretch lg:gap-4',
          mobileMode && 'flex-col gap-2 py-2.5 lg:flex-row lg:py-0 lg:gap-4',
        )}
      >
        {mobileMode ? (
          <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-primary px-3 py-3 text-primary-foreground shadow-md ring-1 ring-primary/20">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
              <SuiteIcon className="size-6 text-amber-200" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight">{mobileShell.suiteTitle}</p>
              <p className="truncate text-xs font-medium text-primary-foreground/85">
                {mobileSubtitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 [&_img]:border-primary-foreground/40">
              {mobileMenuSheet}
              <ThemeToggle variant="onPrimary" />
              <FeedbackNotificationsSheet
                trigger={
                  <Button
                    variant="ghost"
                    mode="icon"
                    shape="circle"
                    className="size-9 text-primary-foreground hover:bg-primary-foreground/15 relative"
                  >
                    <Bell className="size-4.5!" />
                    {feedbackCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-0.5 -end-0.5 size-4 rounded-full p-0 text-[10px] flex items-center justify-center"
                      >
                        {feedbackCount > 99 ? '99+' : feedbackCount}
                      </Badge>
                    )}
                  </Button>
                }
              />
              {/* <ChatSheet
                trigger={
                  <Button
                    variant="ghost"
                    mode="icon"
                    shape="circle"
                    className="size-9 text-primary-foreground hover:bg-primary-foreground/15"
                  >
                    <MessageCircleMore className="size-4.5!" />
                  </Button>
                }
              /> */}
              <UserDropdownMenu
                trigger={
                  <button
                    type="button"
                    className="size-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
                    aria-label="Open account menu"
                  >
                    <img
                      className="size-9 object-cover"
                      src={headerAvatarSrc}
                      alt=""
                    />
                  </button>
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex lg:hidden items-center gap-2 sm:gap-3 min-w-0 shrink-0">
              <Link href="/" className="shrink-0">
                <img
                  src={toAbsoluteUrl('/media/app/logo-small2.png')}
                  className="h-[25px] w-auto"
                  alt="mini-logo"
                />
              </Link>
              {mobileMenuSheet}
            </div>

            {pathname.startsWith('/account') ? (
              <div className="min-w-0 flex-1 overflow-hidden px-2 flex items-center justify-center lg:justify-start">
                <Breadcrumb />
              </div>
            ) : (
              <MegaMenu />
            )}
          </>
        )}

        {!mobileMode && (
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <ThemeToggle />
            {/* <SearchDialog
              trigger={
                <Button
                  variant="ghost"
                  mode="icon"
                  shape="circle"
                  className="size-9 hover:bg-primary/10 hover:[&_svg]:text-primary"
                >
                  <Search className="size-4.5!" />
                </Button>
              }
            /> */}
            <FeedbackNotificationsSheet
              trigger={
                <Button
                  variant="ghost"
                  mode="icon"
                  shape="circle"
                  className="size-9 hover:bg-primary/10 hover:[&_svg]:text-primary relative"
                >
                  <Bell className="size-4.5!" />
                  {feedbackCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-0.5 -end-0.5 size-4 rounded-full p-0 text-[10px] flex items-center justify-center"
                    >
                      {feedbackCount > 99 ? '99+' : feedbackCount}
                    </Badge>
                  )}
                </Button>
              }
            />
            {/* <ChatSheet
              trigger={
                <Button
                  variant="ghost"
                  mode="icon"
                  shape="circle"
                  className="size-9 hover:bg-primary/10 hover:[&_svg]:text-primary"
                >
                  <MessageCircleMore className="size-4.5!" />
                </Button>
              }
            /> */}
            <UserDropdownMenu
              trigger={
                <button
                  type="button"
                  className="size-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Open account menu"
                >
                  <img
                    className="size-9 object-cover"
                    src={headerAvatarSrc}
                    alt=""
                  />
                </button>
              }
            />
          </div>
        )}
      </Container>
    </header>
  );
}
