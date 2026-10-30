'use client';

import { useMemo, useState } from 'react';
import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import {
  buildMonthModifiers,
  formatBatchWeekdayLabels,
  type ParentBatchSchedule,
} from '@/lib/parent-attendance-calendar';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarDays, List } from 'lucide-react';
import Link from 'next/link';

type AttendanceRow = {
  id: string;
  sessionDate: string;
  locationName: string;
  createdAt?: string;
};

type AttendanceApiResponse = {
  data: AttendanceRow[];
  total: number;
  rangeCount?: number;
  batches: ParentBatchSchedule[];
};

function calendarFetchRange(month: Date) {
  const start = startOfMonth(subMonths(month, 1));
  const end = endOfMonth(addMonths(month, 1));
  return {
    from: format(start, 'yyyy-MM-dd'),
    to: format(end, 'yyyy-MM-dd'),
  };
}

export default function ParentTrackerAttendancePage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();
  const [tab, setTab] = useState('list');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const calRange = useMemo(() => calendarFetchRange(calendarMonth), [calendarMonth]);

  const listQuery = useQuery({
    queryKey: ['parent-tracker-attendance', 'list', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(
          API_PATHS.parent.tracker.attendance,
          `studentId=${studentId}&limit=100`,
        ),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<AttendanceApiResponse>;
    },
    enabled: isReady && !!studentId,
  });

  const calendarQuery = useQuery({
    queryKey: [
      'parent-tracker-attendance',
      'calendar',
      studentId,
      calRange.from,
      calRange.to,
    ],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(
          API_PATHS.parent.tracker.attendance,
          `studentId=${studentId}&from=${calRange.from}&to=${calRange.to}`,
        ),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<AttendanceApiResponse>;
    },
    enabled: isReady && !!studentId && tab === 'calendar',
  });

  const attendedYmd = useMemo(() => {
    const rows = calendarQuery.data?.data ?? [];
    return new Set(rows.map((r) => r.sessionDate));
  }, [calendarQuery.data?.data]);

  const calBatches = useMemo(
    () => calendarQuery.data?.batches ?? listQuery.data?.batches ?? [],
    [calendarQuery.data?.batches, listQuery.data?.batches],
  );

  const { present, absent, pending } = useMemo(
    () => buildMonthModifiers(calendarMonth, attendedYmd, calBatches),
    [calendarMonth, attendedYmd, calBatches],
  );

  const monthPresentCount = present.length;
  const monthAbsentCount = absent.length;

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studentId) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-muted-foreground mb-4">Select a child to view attendance.</p>
          <Link href="/parent/children" className="text-primary font-medium hover:underline">
            Select child &rarr;
          </Link>
        </div>
      </Container>
    );
  }

  const listLoading = listQuery.isLoading;
  const listError = listQuery.error;
  const listData = listQuery.data;

  if (listLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listError || !listData) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">Could not load attendance.</p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">
            Back
          </Link>
        </div>
      </Container>
    );
  }

  const batches = listData.batches ?? [];
  const list = listData.data ?? [];
  const total = listData.total ?? 0;

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {total} session{total === 1 ? '' : 's'} recorded (all time)
        </p>
      </div>

      {batches.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Class schedule (from your batch)</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              The calendar uses these weekly times to show absent days in red when class was
              scheduled but no attendance was recorded.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {batches.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2"
                >
                  <span className="font-medium">
                    {[b.programName, b.courseName].filter(Boolean).join(' · ') ||
                      `Batch #${b.id}`}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatBatchWeekdayLabels(b)}
                    {b.locationName ? ` · ${b.locationName}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {batches.length === 0 && (
        <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            No active batch with weekly class times was found. The calendar can only mark
            absent days when your academy has set Mon–Sun times on your batch. Present days
            still appear in green from attendance records.
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="button" className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
          <TabsTrigger value="list" className="gap-2">
            <List className="size-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="size-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Classes attended</CardTitle>
              <span className="text-sm font-normal text-muted-foreground">
                Showing {list.length} of {total}
              </span>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No attendance records yet.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="p-3 tabular-nums">{row.sessionDate}</td>
                          <td className="p-3 text-muted-foreground">{row.locationName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly calendar</CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                Green: attended · Red: missed (scheduled batch day, past, no record) · Amber ring:
                class today, not marked yet
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {calendarQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : calendarQuery.isError ? (
                <p className="text-destructive text-sm text-center py-8">
                  Could not load calendar data.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap justify-center gap-6">
                    <Calendar
                      mode="single"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      modifiers={{
                        present,
                        absent,
                        pending,
                      }}
                      modifiersClassNames={{
                        present:
                          '!bg-emerald-600 !text-white hover:!bg-emerald-700 data-[selected]:!bg-emerald-600 font-semibold rounded-md',
                        absent:
                          '!bg-red-600 !text-white hover:!bg-red-700 data-[selected]:!bg-red-600 font-semibold rounded-md',
                        pending:
                          '!bg-amber-400 !text-amber-950 hover:!bg-amber-500 ring-2 ring-amber-600/80 ring-offset-2 ring-offset-background rounded-md font-medium',
                      }}
                      className="rounded-lg border border-border p-2"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-md bg-emerald-600 shrink-0" />
                      <span>Attended</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-md bg-red-600 shrink-0" />
                      <span>Absent (scheduled)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-md bg-amber-400 ring-2 ring-amber-600/80 shrink-0" />
                      <span>Today (pending)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-6 rounded-md border border-border bg-background shrink-0" />
                      <span>No class</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-center text-sm">
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                      <div className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {monthPresentCount}
                      </div>
                      <div className="text-muted-foreground">Present in month</div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                      <div className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {monthAbsentCount}
                      </div>
                      <div className="text-muted-foreground">Absent in month</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
