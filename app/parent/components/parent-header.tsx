'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserDropdownMenu } from '@/partials/topbar/user-dropdown-menu';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { FeedbackNotificationsSheet, useFeedbackNotificationsCount } from '@/partials/topbar/feedback-notifications-sheet';
import { SidebarMenu } from '@/app/components/layouts/demo1/components/sidebar-menu';
import { Bell, ChevronDown, Menu, Users } from 'lucide-react';
import { Container } from '@/components/common/container';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserRole } from '@/constants/roles';
import { User } from '@/utils/menuUtils';
import { getMobileShellConfig } from '@/config/mobile-app-shell.config';
import { useTenant } from '@/hooks/use-tenant';
import { sessionAvatarUrl } from '@/lib/user-account-nav';
import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';

type Child = { id: string; name: string; level: string | null };

export function ParentHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const feedbackCount = useFeedbackNotificationsCount();
  const {
    selectedStudentId: currentStudentId,
    setSelectedStudentId,
    isReady: childSelectionReady,
  } = useParentSelectedStudent();
  const mobileMode = useIsMobile();
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const isDashboard = pathname === '/parent/dashboard';
  const isTracker = pathname?.startsWith('/parent/tracker') || pathname === '/parent/fitness-videos';

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

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.parent.children);
      if (!res.ok) throw new Error('Failed to fetch children');
      return res.json();
    },
  });
  const children = (childrenData?.data ?? []) as Child[];
  const currentChild = children.find((c) => c.id === currentStudentId);
  const { tenant, location } = useTenant();
  const mobileShell = getMobileShellConfig(session?.user?.roleSlug??undefined);
  const SuiteIcon = mobileShell.suiteIcon;
  const mobileSubtitle =
    tenant?.academyName ||
    location?.centerName ||
    session?.user?.email ||
    'My Academy';

  const profileAvatarSrc = sessionAvatarUrl(
    session?.user?.avatar,
    toAbsoluteUrl,
  );

  useEffect(() => {
    setIsSidebarSheetOpen(false);
  }, [pathname]);

  const menuSheet = (
    <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          mode="icon"
          className={cn(
            'shrink-0 size-9',
            mobileMode && 'text-primary-foreground hover:bg-primary-foreground/15',
          )}
          aria-label="Open menu"
        >
          <Menu className={cn('size-5', !mobileMode && 'text-muted-foreground/70')} />
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
        'header top-0 z-10 start-0 flex items-stretch shrink-0 border-b border-border bg-background end-0',
        mobileMode ? 'sticky' : 'fixed',
      )}
    >
      <Container
        width="fluid"
        className={cn(
          'flex justify-between items-stretch gap-4',
          mobileMode && 'flex-col gap-2 py-2.5',
        )}
      >
        {mobileMode ? (
          <div className="flex w-full min-w-0 flex-col gap-2 rounded-2xl bg-primary px-3 py-3 text-primary-foreground shadow-md ring-1 ring-primary/20">
            <div className="flex min-w-0 items-center gap-2">
              {menuSheet}
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
                <SuiteIcon className="size-6 text-amber-200" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight">{mobileShell.suiteTitle}</p>
                <p className="truncate text-xs font-medium text-primary-foreground/85">
                  {mobileSubtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <ThemeToggle variant="onPrimary" />
                <FeedbackNotificationsSheet
                  trigger={
                    <Button
                      variant="ghost"
                      mode="icon"
                      shape="circle"
                      className="size-9 text-primary-foreground hover:bg-primary-foreground/15 relative"
                      aria-label="Feedback and messages"
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
                <UserDropdownMenu
                  trigger={
                    <button
                      type="button"
                      className="size-9 shrink-0 overflow-hidden rounded-full border-2 border-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
                      aria-label="Open account menu"
                    >
                      <img
                        className="size-9 object-cover"
                        src={profileAvatarSrc}
                        alt=""
                      />
                    </button>
                  }
                />
              </div>
            </div>
            {children.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 w-full justify-between gap-2 border-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="size-4 shrink-0" />
                      <span className="truncate">
                        {(isDashboard || isTracker) && currentChild
                          ? currentChild.name
                          : !childSelectionReady
                            ? '…'
                            : 'Select child'}
                      </span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[min(100vw-2rem,280px)]">
                  {children.map((child) => (
                    <DropdownMenuItem
                      key={child.id}
                      onSelect={() => {
                        setSelectedStudentId(child.id);
                        const base =
                          (isDashboard || isTracker) && pathname
                            ? pathname.split('?')[0]
                            : '/parent/dashboard';
                        router.push(base || '/parent/dashboard');
                      }}
                    >
                      {child.name}
                      {child.level ? ` · ${child.level}` : ''}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {children.length === 1 &&
              (isDashboard || isTracker) &&
              childSelectionReady &&
              !currentStudentId && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full border-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                  onClick={() => {
                    setSelectedStudentId(children[0].id);
                    router.push('/parent/dashboard');
                  }}
                >
                  View {children[0].name}&apos;s dashboard
                </Button>
              )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
              <Link href="/parent" className="flex items-center gap-2 shrink-0">
                <img
                  src={toAbsoluteUrl('/media/app/logo-small2.png')}
                  className="h-[25px] w-auto"
                  alt="Connect My Gym"
                />
                <span className="font-semibold text-foreground hidden sm:inline">Parent Portal</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
              {children.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0 max-w-[200px] sm:max-w-none"
                    >
                      <Users className="size-4 shrink-0" />
                      <span className="truncate">
                        {(isDashboard || isTracker) && currentChild
                          ? currentChild.name
                          : !childSelectionReady
                            ? '…'
                            : 'Select child'}
                      </span>
                      <ChevronDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {children.map((child) => (
                      <DropdownMenuItem
                        key={child.id}
                        onSelect={() => {
                          setSelectedStudentId(child.id);
                          const base =
                            (isDashboard || isTracker) && pathname
                              ? pathname.split('?')[0]
                              : '/parent/dashboard';
                          router.push(base || '/parent/dashboard');
                        }}
                      >
                        {child.name}
                        {child.level ? ` · ${child.level}` : ''}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {children.length === 1 &&
                (isDashboard || isTracker) &&
                childSelectionReady &&
                !currentStudentId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedStudentId(children[0].id);
                      router.push('/parent/dashboard');
                    }}
                  >
                    View {children[0].name}&apos;s dashboard
                  </Button>
                )}

              <ThemeToggle />

              <FeedbackNotificationsSheet
                trigger={
                  <Button
                    variant="ghost"
                    mode="icon"
                    shape="circle"
                    className="size-9 relative hover:bg-primary/10 hover:[&_svg]:text-primary"
                    aria-label="Feedback and messages"
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

              <UserDropdownMenu
                trigger={
                  <button
                    type="button"
                    className="rounded-full border-2 border-primary/30 overflow-hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Open account menu"
                  >
                    <img
                      className="size-9 object-cover"
                      src={profileAvatarSrc}
                      alt=""
                    />
                  </button>
                }
              />
            </div>
          </>
        )}
      </Container>
    </header>
  );
}
