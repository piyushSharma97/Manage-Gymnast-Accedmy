'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Calendar,
  CheckCircle2,
  Circle,
  History,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/hooks/use-tenant';
import {
  MobileAttendanceToggle,
  MobileEntityRow,
  MobileFilterChips,
  MobileFormFieldCard,
  MobileInfoBanner,
  MobilePageCanvas,
  MobilePillControl,
  MobilePrimaryAction,
  MobileSegmentTabs,
  MobileStackScreenHeader,
  MobileStatusDot,
  MobileSummaryStrip,
} from '@/components/mobile-pattern';

export type StaffAttendanceRole = 'admin' | 'manager' | 'coach';

function attendanceApiUrl(role: StaffAttendanceRole): string {
  switch (role) {
    case 'admin':
      return API_PATHS.gymnastManagement.attendance;
    case 'manager':
      return API_PATHS.manager.gymnastManagement.attendance;
    case 'coach':
      return API_PATHS.coach.gymnastManagement.attendance;
  }
}

const MOBILE_BACK_HREF: Record<StaffAttendanceRole, string> = {
  admin: '/admin/dashboard/batch',
  manager: '/manager/dashboard/batch',
  coach: '/coach/gymnast-management/students',
};

const generateTimeOptions = () => {
  const times = [];
  for (let hour = 7; hour <= 19; hour++) {
    const time12h = hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`;
    times.push({ value: time12h, label: time12h });
  }
  return times;
};

const timeOptions = generateTimeOptions();

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
function getDayFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return dayNames[d.getDay()];
}

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  hasAttendance?: boolean;
  batches?: Array<{
    id: number;
    courseName: string | null;
    programName: string | null;
  }>;
};

type BatchOption = { value: string; label: string; programId: number; courseId: number };

type Props = { role: StaffAttendanceRole };

export function StaffAttendanceList({ role }: Props) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  const attendanceUrl = attendanceApiUrl(role);
  const mobileBackHref = MOBILE_BACK_HREF[role];

  const [mobileTab, setMobileTab] = useState<'mark' | 'history' | 'flagged'>('mark');
  const [locationId, setLocationId] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [batchValue, setBatchValue] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [searchTrigger, setSearchTrigger] = useState(0);

  const day = getDayFromDate(sessionDate);

  const { data: locations } = useQuery({
    queryKey: ['locations-select-staff', role],
    queryFn: async () => {
      const response = await apiFetch('/api/location/select');
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
  });

  useEffect(() => {
    if (!locations || locations.length !== 1 || locationId) return;
    setLocationId(String(locations[0].id));
  }, [locations, locationId]);

  const { data: batchOptions } = useQuery<BatchOption[]>({
    queryKey: ['attendance-batches', role, locationId, sessionDate, time],
    queryFn: async () => {
      if (!locationId || !sessionDate || !time) return [];
      const params = new URLSearchParams({
        locationId,
        sessionDate,
        time,
      });
      const response = await apiFetch(withParams(API_PATHS.gymnastManagement.attendanceBatches, params));
      if (!response.ok) throw new Error('Failed to fetch batches');
      return response.json();
    },
    enabled: !!locationId && !!sessionDate && !!time,
  });

  const { data: students, isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ['attendance-students', role, locationId, day, time, batchValue, searchTrigger, sessionDate],
    queryFn: async () => {
      if (!locationId || !day || !time) return [];
      const params = new URLSearchParams({
        locationId,
        day,
        time,
      });
      if (sessionDate) params.append('sessionDate', sessionDate);
      const selectedBatch = batchOptions?.find((b) => b.value === batchValue);
      if (selectedBatch) {
        params.append('programId', String(selectedBatch.programId));
        params.append('courseId', String(selectedBatch.courseId));
      }
      const response = await apiFetch(withParams(attendanceUrl, params));
      if (!response.ok) throw new Error('Failed to fetch students');
      return response.json();
    },
    enabled:
      searchTrigger > 0 &&
      !!locationId &&
      !!day &&
      !!time &&
      (!batchValue || batchOptions !== undefined),
  });

  const attendanceMutation = useMutation({
    mutationFn: async (data: { studentIds: string[]; locationId: string; sessionDate: string }) => {
      const response = await apiFetch(attendanceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>
              {data.message}
              {data.skipped > 0 && ` (${data.skipped} already marked)`}
            </AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
      setSelectedStudents(new Set());
      queryClient.invalidateQueries({ queryKey: ['attendance-students', role] });
    },
    onError: (error: Error) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    },
  });

  const handleSearch = () => {
    if (!locationId || !sessionDate || !time) {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>Please select location, date, and time</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
      return;
    }
    setSelectedStudents(new Set());
    setSearchTrigger((prev) => prev + 1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && students) {
      const selectableStudents = students.filter(s => !s.hasAttendance);
      setSelectedStudents(new Set(selectableStudents.map((s) => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleSubmit = () => {
    if (selectedStudents.size === 0) {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>Please select at least one student</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
      return;
    }

    if (!sessionDate) {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>Please select a date</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
      return;
    }

    attendanceMutation.mutate({
      studentIds: Array.from(selectedStudents),
      locationId,
      sessionDate,
    });
  };

  useEffect(() => {
    if (searchTrigger > 0 && locationId && day && time && sessionDate) {
      queryClient.invalidateQueries({ queryKey: ['attendance-students', role] });
      setSelectedStudents(new Set());
    }
  }, [sessionDate, searchTrigger, locationId, day, time, queryClient, role]);

  const selectableStudents = students?.filter(s => !s.hasAttendance) || [];
  const allSelected = selectableStudents.length > 0 && selectedStudents.size === selectableStudents.length;

  const batchChipOptions = useMemo(() => {
    if (!batchOptions?.length) return [];
    return [
      { id: '__all', label: 'All' },
      ...batchOptions.map((b) => ({
        id: b.value,
        label: b.label.length > 16 ? `${b.label.slice(0, 14)}…` : b.label,
      })),
    ];
  }, [batchOptions]);

  const mobileSegments = useMemo(
    () => [
      { id: 'mark' as const, label: 'Mark', icon: ClipboardList },
      { id: 'history' as const, label: 'History', icon: History },
      { id: 'flagged' as const, label: 'Flagged', icon: AlertTriangle },
    ],
    [],
  );

  const sessionDateLabel = sessionDate
    ? new Date(`${sessionDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : '';

  const markedCount = students?.filter((s) => s.hasAttendance).length ?? 0;
  const rosterSize = students?.length ?? 0;

  if (isMobile) {
    return (
      <MobilePageCanvas>
        <MobileStackScreenHeader
          title="Attendance"
          subtitle={tenant?.academyName ?? 'My Academy'}
          backHref={mobileBackHref}
          right={
            batchChipOptions.length >= 2 ? (
              <MobileFilterChips
                options={batchChipOptions}
                value={batchValue || '__all'}
                onChange={(id) => {
                  setBatchValue(id === '__all' ? '' : id);
                }}
              />
            ) : null
          }
        />

        <MobileSegmentTabs
          tabs={mobileSegments}
          activeId={mobileTab}
          onChange={(id) => setMobileTab(id as typeof mobileTab)}
        />

        {mobileTab === 'history' && (
          <MobileInfoBanner
            variant="neutral"
            title="Attendance history"
            description={
              role === 'admin' ? (
                <>
                  Open{' '}
                  <Link href="/admin/reports/attendance/monthly" className="font-semibold text-primary underline">
                    monthly attendance
                  </Link>{' '}
                  or{' '}
                  <Link href="/admin/reports/attendance/student" className="font-semibold text-primary underline">
                    per-student history
                  </Link>
                  .
                </>
              ) : (
                'Ask your academy administrator for historical attendance reports or exports.'
              )
            }
          />
        )}

        {mobileTab === 'flagged' && (
          <MobileInfoBanner
            variant="neutral"
            title="Flagged"
            description="Review absences and patterns from reporting tools on a larger screen when needed."
          />
        )}

        {mobileTab === 'mark' && (
          <>
            <MobileInfoBanner
              title="Mark attendance"
              description="Choose location, session date, and time, then load the roster for this class."
            />

            <div className="space-y-3">
              <MobileFormFieldCard label="Location">
                <MobilePillControl>
                  <Select
                    value={locationId}
                    onValueChange={(v) => {
                      setLocationId(v);
                      setBatchValue('');
                    }}
                  >
                    <SelectTrigger className="h-11 border-0 bg-transparent shadow-none focus:ring-0">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((location: import('@/types/domain').LocationSelectOption) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.centerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </MobilePillControl>
              </MobileFormFieldCard>

              <MobileFormFieldCard label="Session date">
                <MobilePillControl>
                  <div className="relative flex items-center">
                    <Calendar className="absolute start-3 size-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={sessionDate}
                      onChange={(e) => {
                        setSessionDate(e.target.value);
                        setBatchValue('');
                      }}
                      className="h-11 border-0 bg-transparent ps-10 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </MobilePillControl>
              </MobileFormFieldCard>

              <MobileFormFieldCard label="Time">
                <MobilePillControl>
                  <Select
                    value={time}
                    onValueChange={(v) => {
                      setTime(v);
                      setBatchValue('');
                    }}
                  >
                    <SelectTrigger className="h-11 border-0 bg-transparent shadow-none focus:ring-0">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((timeOption) => (
                        <SelectItem key={timeOption.value} value={timeOption.value}>
                          {timeOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </MobilePillControl>
              </MobileFormFieldCard>

              {batchOptions && batchOptions.length > 0 && batchChipOptions.length < 2 ? (
                <MobileFormFieldCard label="Batch (optional)">
                  <MobilePillControl>
                    <Select value={batchValue} onValueChange={setBatchValue} disabled={!locationId || !sessionDate || !time}>
                      <SelectTrigger className="h-11 border-0 bg-transparent shadow-none focus:ring-0">
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </MobilePillControl>
                </MobileFormFieldCard>
              ) : null}

              <MobilePrimaryAction type="button" onClick={handleSearch}>
                <Search className="mr-2 size-4" />
                Load students
              </MobilePrimaryAction>
            </div>

            {searchTrigger > 0 && (
              <div className="mt-5 space-y-3">
                <p className="mp-section-title px-0.5">Students</p>
                {isLoadingStudents ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
                    ))}
                  </div>
                ) : students && students.length > 0 ? (
                  <>
                    <MobileSummaryStrip
                      titleRow={
                        <span className="flex items-center gap-2 text-foreground">
                          <Calendar className="size-4 shrink-0" />
                          {sessionDateLabel}
                        </span>
                      }
                    >
                      <MobileStatusDot colorClass="bg-emerald-500" label={`Marked: ${markedCount}`} />
                      <MobileStatusDot colorClass="bg-amber-500" label={`On roster: ${rosterSize}`} />
                      <MobileStatusDot colorClass="bg-sky-600" label={`Selected: ${selectedStudents.size}`} />
                    </MobileSummaryStrip>

                    <button
                      type="button"
                      onClick={() => handleSelectAll(!allSelected)}
                      disabled={selectableStudents.length === 0}
                      className={cn(
                        'mb-1 flex w-full items-center justify-between rounded-2xl border border-border/80 bg-card px-3 py-2 text-left text-sm font-medium shadow-sm',
                        selectableStudents.length === 0 && 'opacity-50',
                      )}
                    >
                      <span>Select all eligible</span>
                      <span className="text-muted-foreground">
                        {selectedStudents.size}/{selectableStudents.length}
                      </span>
                    </button>

                    <div className="space-y-2">
                      {students.map((student) => {
                        const hasAttendance = student.hasAttendance || false;
                        const isMarked = selectedStudents.has(student.id);
                        const name = `${student.firstName} ${student.lastName || ''}`.trim();
                        return (
                          <MobileEntityRow
                            key={student.id}
                            id={student.id}
                            firstName={student.firstName}
                            lastName={student.lastName}
                            subline={`Reg. ${student.registrationNo}${hasAttendance ? ' · Already marked' : ''}`}
                            muted={hasAttendance}
                            selected={!hasAttendance && isMarked}
                            trailing={
                              <MobileAttendanceToggle
                                hasAttendance={hasAttendance}
                                isMarked={isMarked}
                                onToggle={() => handleSelectStudent(student.id, !isMarked)}
                                disabled={hasAttendance}
                                nameForAria={name}
                              />
                            }
                          />
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <MobilePrimaryAction
                        onClick={handleSubmit}
                        disabled={attendanceMutation.isPending || selectedStudents.size === 0}
                      >
                        {attendanceMutation.isPending ? 'Submitting…' : 'Submit attendance'}
                      </MobilePrimaryAction>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-card/50 py-10 text-center text-sm text-muted-foreground">
                    No students for this session
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </MobilePageCanvas>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select value={locationId} onValueChange={(v) => { setLocationId(v); setBatchValue(''); }}>
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((location: import('@/types/domain').LocationSelectOption) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.centerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionDate">Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="sessionDate"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => { setSessionDate(e.target.value); setBatchValue(''); }}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <Select value={time} onValueChange={(v) => { setTime(v); setBatchValue(''); }}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((timeOption) => (
                    <SelectItem key={timeOption.value} value={timeOption.value}>
                      {timeOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch">Batch</Label>
              <Select value={batchValue} onValueChange={setBatchValue} disabled={!locationId || !sessionDate || !time}>
                <SelectTrigger id="batch">
                  <SelectValue placeholder={batchOptions?.length ? 'Select batch (optional)' : 'No batches'} />
                </SelectTrigger>
                <SelectContent>
                  {batchOptions?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleSearch} className="w-full" type="button">
                <Search className="mr-2 h-4 w-4" />
                Load students
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {searchTrigger > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStudents ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : students && students.length > 0 ? (
              <>
                <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 border-b">
                  <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Attendance
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(!allSelected)}
                    disabled={selectableStudents.length === 0}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium transition-colors rounded-full p-1',
                      selectableStudents.length === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                    aria-label="Select all students"
                  >
                    {allSelected ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 fill-green-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground">
                      Select all ({selectedStudents.size}/{selectableStudents.length})
                      {students.length > selectableStudents.length && (
                        <span className="text-muted-foreground/80 ml-1">
                          · {students.length - selectableStudents.length} already marked
                        </span>
                      )}
                    </span>
                  </button>
                </div>

                <div className="space-y-0 max-h-[400px] overflow-y-auto">
                  {students.map((student) => {
                    const hasAttendance = student.hasAttendance || false;
                    const isMarked = selectedStudents.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={cn(
                          'flex items-center justify-between gap-4 py-3 px-3 rounded-md border-b border-transparent transition-colors',
                          hasAttendance && 'opacity-60',
                          !hasAttendance && 'hover:bg-muted/40',
                          isMarked && 'bg-green-50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/50'
                        )}
                      >
                        <div className="flex items-center gap-2 shrink-0 w-32">
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            Attendance
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 font-medium">
                          {student.firstName} {student.lastName || ''}
                          {hasAttendance && (
                            <span className="text-xs text-muted-foreground italic font-normal ml-2">
                              Already marked
                            </span>
                          )}
                        </div>

                        <div className="shrink-0">
                          {hasAttendance ? (
                            <CheckCircle2
                              className="h-7 w-7 text-green-600 fill-green-600 opacity-70"
                              aria-hidden
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectStudent(student.id, !isMarked)}
                              className={cn(
                                'rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                isMarked
                                  ? 'text-green-600 [&_svg]:fill-green-600'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                              aria-label={isMarked ? `Unmark ${student.firstName} ${student.lastName || ''}` : `Mark present: ${student.firstName} ${student.lastName || ''}`}
                            >
                              {isMarked ? (
                                <CheckCircle2 className="h-7 w-7" />
                              ) : (
                                <Circle className="h-7 w-7" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={handleSubmit}
                    disabled={attendanceMutation.isPending || selectedStudents.size === 0}
                    className="w-full"
                  >
                    {attendanceMutation.isPending ? 'Submitting...' : 'Submit Attendance'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No students found for the selected criteria
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StaffAttendanceList;
