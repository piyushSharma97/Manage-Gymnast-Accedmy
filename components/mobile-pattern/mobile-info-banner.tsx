'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/50',
  neutral: 'bg-[hsl(40_45%_94%)] text-foreground ring-black/5 dark:bg-muted/50',
} as const;

export function MobileInfoBanner({
  title,
  description,
  variant = 'success',
  className,
}: {
  title: string;
  description?: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 rounded-2xl px-3 py-2.5 text-sm shadow-sm ring-1',
        variants[variant],
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      {description ? <div className="mt-0.5 text-xs opacity-90">{description}</div> : null}
    </div>
  );
}
