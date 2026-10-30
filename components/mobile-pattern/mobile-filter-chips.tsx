'use client';

import { cn } from '@/lib/utils';

export type MobileFilterChipOption = { id: string; label: string };

/** Pill toggles (e.g. batch / class filters) — yellow active state per reference. */
export function MobileFilterChips({
  options,
  value,
  onChange,
  className,
}: {
  options: MobileFilterChipOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  if (options.length < 2) return null;
  return (
    <div className={cn('flex flex-wrap justify-end gap-1', className)} role="group" aria-label="Filter">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
              active
                ? 'bg-amber-400 text-primary'
                : 'border border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
