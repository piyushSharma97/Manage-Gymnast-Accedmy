'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobilePrimaryAction({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { children: ReactNode }) {
  return (
    <Button
      size="lg"
      className={cn(
        'h-12 w-full rounded-2xl text-base font-semibold shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
