'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ThemeToggleProps = {
  className?: string;
  /** e.g. on primary mobile header bars */
  variant?: 'default' | 'onPrimary';
};

export function ThemeToggle({ className, variant = 'default' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      mode="icon"
      shape="circle"
      className={cn(
        'size-9 shrink-0',
        variant === 'default' &&
          'hover:bg-primary/10 hover:[&_svg]:text-primary text-muted-foreground',
        variant === 'onPrimary' &&
          'text-primary-foreground hover:bg-primary-foreground/15 [&_svg]:text-primary-foreground',
        className,
      )}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      disabled={!mounted}
    >
      {!mounted ? (
        <Sun className="size-4.5 opacity-40" aria-hidden />
      ) : isDark ? (
        <Sun className="size-4.5" aria-hidden />
      ) : (
        <Moon className="size-4.5" aria-hidden />
      )}
    </Button>
  );
}
