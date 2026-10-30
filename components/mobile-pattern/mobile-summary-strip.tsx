'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Beige strip: date line + optional status row (dots / counts). */
export function MobileSummaryStrip({
  titleRow,
  children,
  className,
}: {
  titleRow: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 rounded-2xl bg-[hsl(40_45%_94%)] px-3 py-2.5 text-sm shadow-sm ring-1 ring-black/5 dark:bg-muted/40',
        className,
      )}
    >
      <div className="font-medium text-foreground">{titleRow}</div>
      {children ? <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">{children}</div> : null}
    </div>
  );
}

export function MobileStatusDot({
  colorClass,
  label,
}: {
  colorClass: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', colorClass)} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
