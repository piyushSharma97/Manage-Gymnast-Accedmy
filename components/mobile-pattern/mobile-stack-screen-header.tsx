'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * In-screen header: deep blue bar, back, title + subtitle, optional right slot (e.g. filter chips).
 */
export function MobileStackScreenHeader({
  title,
  subtitle,
  backHref,
  onBack,
  className,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  className?: string;
  right?: ReactNode;
}) {
  const backBtn = (
    <button
      type="button"
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground hover:bg-primary-foreground/15"
      aria-label="Go back"
      onClick={onBack}
    >
      <ChevronLeft className="size-6" strokeWidth={2.25} />
    </button>
  );

  return (
    <header
      className={cn(
        'mb-3 flex items-center gap-2 rounded-2xl bg-primary px-2 py-2.5 text-primary-foreground shadow-md ring-1 ring-primary/20',
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-primary-foreground/15"
          aria-label="Go back"
        >
          <ChevronLeft className="size-6" strokeWidth={2.25} />
        </Link>
      ) : onBack ? (
        backBtn
      ) : (
        <span className="size-9 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold leading-tight">{title}</h1>
        {subtitle ? (
          <p className="truncate text-xs font-medium text-primary-foreground/85">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{right}</div> : null}
    </header>
  );
}
