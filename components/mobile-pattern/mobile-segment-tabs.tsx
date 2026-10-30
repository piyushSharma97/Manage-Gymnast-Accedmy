'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileSegmentTab = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export function MobileSegmentTabs({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: MobileSegmentTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const groupId = useId();
  const groupName = `mobile-segment-${groupId.replace(/:/g, '')}`;

  return (
    <fieldset
      className={cn(
        'mb-3 space-y-0 rounded-xl border-0 bg-background p-1 shadow-sm ring-1 ring-border/80',
        className,
      )}
    >
      <legend className="sr-only">Section</legend>
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeId;
          return (
            <label
              key={tab.id}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] font-semibold transition-colors',
                active
                  ? 'border-b-2 border-primary bg-primary/5 text-primary'
                  : 'border-b-2 border-transparent text-muted-foreground',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={tab.id}
                checked={active}
                onChange={() => onChange(tab.id)}
                className="sr-only"
              />
              <Icon className={cn('size-4', active && 'text-primary')} strokeWidth={active ? 2.5 : 2} />
              {tab.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
