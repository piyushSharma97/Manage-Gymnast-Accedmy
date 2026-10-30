'use client';

import { type ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/** Cream / neutral canvas behind cards — matches native-style reference screens. */
export function MobilePageCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const mobile = useIsMobile();
  if (!mobile) return <>{children}</>;
  return (
    <div
      className={cn(
        'rounded-t-2xl bg-[hsl(42_38%_96%)] px-3 pb-4 pt-1 dark:bg-muted/25',
        className,
      )}
    >
      {children}
    </div>
  );
}
