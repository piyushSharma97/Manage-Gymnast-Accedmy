'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { personInitials } from '@/lib/person-initials';
import { cn } from '@/lib/utils';

const avatarColors = [
  'bg-emerald-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-600',
];

function avatarClassForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 997;
  return avatarColors[h % avatarColors.length];
}

export function MobileEntityRow({
  id,
  firstName,
  lastName,
  subline,
  trailing,
  onRowClick,
  muted,
  selected,
  className,
}: {
  id: string;
  firstName: string;
  lastName: string | null | undefined;
  subline?: string;
  trailing?: ReactNode;
  onRowClick?: () => void;
  muted?: boolean;
  selected?: boolean;
  className?: string;
}) {
  const initials = personInitials(firstName, lastName);
  const content = (
    <>
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
          avatarClassForId(id),
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">
          {firstName} {lastName || ''}
        </p>
        {subline ? <p className="truncate text-xs text-muted-foreground">{subline}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </>
  );

  const base =
    'flex items-center gap-3 rounded-2xl border bg-card px-3 py-3 shadow-sm ring-1 ring-black/[0.04] transition-colors';

  if (onRowClick) {
    return (
      <button
        type="button"
        onClick={onRowClick}
        className={cn(
          base,
          'w-full text-start active:scale-[0.99]',
          muted && 'opacity-60',
          selected && 'border-primary/40 bg-primary/5',
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        base,
        muted && 'opacity-60',
        selected && 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30',
        className,
      )}
    >
      {content}
    </div>
  );
}

/** Large circular present toggle (attendance pattern). */
export function MobileAttendanceToggle({
  hasAttendance,
  isMarked,
  onToggle,
  disabled,
  nameForAria,
}: {
  hasAttendance: boolean;
  isMarked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  nameForAria: string;
}) {
  if (hasAttendance) {
    return (
      <CheckCircle2
        className="size-9 shrink-0 text-emerald-600 opacity-80 [&>circle]:fill-emerald-600"
        aria-hidden
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-label={isMarked ? `Unmark ${nameForAria}` : `Mark present: ${nameForAria}`}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors',
        isMarked ? 'bg-emerald-600 text-white shadow-md' : 'bg-muted text-muted-foreground',
      )}
    >
      {isMarked ? (
        <CheckCircle2 className="size-6 text-white" strokeWidth={2.5} />
      ) : (
        <Circle className="size-6" strokeWidth={2} />
      )}
    </button>
  );
}

export function MobileChevronTrail() {
  return <ChevronRight className="size-5 text-muted-foreground/70" />;
}
