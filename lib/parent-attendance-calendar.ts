import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
} from 'date-fns';

/** Prisma batch weekday columns — JS getDay(): 0 = Sunday */
export const BATCH_WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type BatchWeekdayKey = (typeof BATCH_WEEKDAY_KEYS)[number];

export type ParentBatchSchedule = {
  id: number;
  courseName: string | null;
  programName: string | null;
  locationName: string | null;
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
};

export function batchDayHasSession(
  batch: ParentBatchSchedule,
  key: BatchWeekdayKey,
): boolean {
  const raw = batch[key];
  return raw != null && String(raw).trim().length > 0;
}

const WEEKDAY_SHORT: Record<BatchWeekdayKey, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

/** e.g. "Mon, Wed, Fri" for batch row labels */
export function formatBatchWeekdayLabels(batch: ParentBatchSchedule): string {
  const labels: string[] = [];
  for (const key of BATCH_WEEKDAY_KEYS) {
    if (batchDayHasSession(batch, key)) labels.push(WEEKDAY_SHORT[key]);
  }
  return labels.join(', ') || '—';
}

/** True if any active batch schedules this calendar weekday (class time set). */
export function isScheduledByBatch(date: Date, batches: ParentBatchSchedule[]): boolean {
  if (!batches.length) return false;
  const key = BATCH_WEEKDAY_KEYS[date.getDay()];
  return batches.some((b) => batchDayHasSession(b, key));
}

export type CalendarDayModifiers = {
  present: Date[];
  absent: Date[];
  pending: Date[];
};

/**
 * Build day lists for react-day-picker modifiers in `month`.
 * Present: has attendance record. Absent: batch day in the past, no attendance.
 * Pending: batch day is today, no attendance yet.
 */
export function buildMonthModifiers(
  month: Date,
  attendedYmd: Set<string>,
  batches: ParentBatchSchedule[],
): CalendarDayModifiers {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const today = startOfDay(new Date());

  const present: Date[] = [];
  const absent: Date[] = [];
  const pending: Date[] = [];

  for (const d of eachDayOfInterval({ start, end })) {
    const ymd = format(d, 'yyyy-MM-dd');
    if (attendedYmd.has(ymd)) {
      present.push(d);
      continue;
    }
    if (!isScheduledByBatch(d, batches)) continue;

    const dayStart = startOfDay(d);
    if (isBefore(dayStart, today)) {
      absent.push(d);
    } else if (isSameDay(d, today)) {
      pending.push(d);
    }
  }

  return { present, absent, pending };
}
