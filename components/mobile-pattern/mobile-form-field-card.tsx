'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * White card: optional leading icon, bold label, then full-width control (place pill input inside).
 */
export function MobileFormFieldCard({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card p-3 shadow-sm',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {Icon ? <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} /> : null}
        <span className="text-sm font-bold text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Rounded “pill” control well (inputs, selects, date). */
export function MobilePillControl({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[hsl(42_32%_92%)] px-3 py-0.5 ring-1 ring-black/[0.04] dark:bg-muted/60',
        className,
      )}
    >
      {children}
    </div>
  );
}
