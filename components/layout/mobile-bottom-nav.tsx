'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  getMobileShellConfig,
  isNavItemActive,
  type MobileNavItem,
} from '@/config/mobile-app-shell.config';
import { cn } from '@/lib/utils';

function resolveActiveHref(pathname: string, nav: MobileNavItem[]): string | undefined {
  let best: { href: string; len: number } | undefined;
  for (const item of nav) {
    if (!isNavItemActive(pathname, item.href)) continue;
    const len = item.href.length;
    if (!best || len > best.len) best = { href: item.href, len };
  }
  return best?.href;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const config = getMobileShellConfig(session?.user?.roleSlug ?? undefined);
  const activeHref = resolveActiveHref(pathname, config.bottomNav);

  if (config.bottomNav.length === 0) return null;

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch justify-around gap-0.5 px-1 pt-1.5">
        {config.bottomNav.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 px-1 transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  active ? 'bg-primary-foreground/15' : 'bg-transparent',
                )}
              >
                <Icon className="size-[1.15rem] shrink-0" strokeWidth={active ? 2.25 : 2} />
              </span>
              <span className="max-w-full truncate text-center text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
