'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getMobileShellConfig } from '@/config/mobile-app-shell.config';
import { cn } from '@/lib/utils';

 /** Two alternating tile styles (navy + amber) for mobile quick actions grid */
const QUICK_TILE_STYLES = [
  'bg-slate-800 text-white',
  'bg-amber-500 text-slate-900',
] as const;

export function MobileQuickActionsHub() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const config = getMobileShellConfig(session?.user?.roleSlug??undefined );

  if (
    !config.quickTiles.length ||
    !config.showQuickActionsOnPath(pathname)
  ) {
    return null;
  }

  return (
    <section className="lg:hidden px-4 pt-2 pb-4" aria-label="Quick actions">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {config.quickTiles.map((tile, index) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={cn(
                'flex min-h-[104px] flex-col rounded-2xl p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.98]',
                QUICK_TILE_STYLES[index % QUICK_TILE_STYLES.length],
              )}
            >
              <Icon className="mb-2 size-5 shrink-0 opacity-95" strokeWidth={2} />
              <span className="text-sm font-bold leading-snug">{tile.title}</span>
              <span className="mt-0.5 text-xs font-medium leading-snug opacity-90">
                {tile.description}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
