'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardToolbar,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Search, X } from 'lucide-react';

type AttendanceRecord = {
  id: string;
  sessionDate: string;
  locationName: string;
  createdAt: string;
};

type StudentInfo = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  courseName: string | null;
};

type StudentSelectItem = {
  id: number | string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
};

const StudentAttendanceCalendar = () => {
  // Student selection
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Calendar month navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Fetch students for selection
  const { data: studentsData } = useQuery<StudentSelectItem[]>({
    queryKey: ['students-select', studentSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (studentSearchQuery) {
        params.set('query', studentSearchQuery);
      }
      params.set('status', 'ACTIVE');
      const response = await apiFetch(`/api/student/select?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch all attendance data for selected student
  const { data: attendanceData, isLoading } = useQuery<{
    data: AttendanceRecord[];
    student: StudentInfo;
    pagination: { total: number };
  }>({
    queryKey: ['student-attendance-calendar', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) {
        return {
          data: [],
          student: {} as StudentInfo,
          pagination: { total: 0 },
        };
      }

      const params = new URLSearchParams({
        studentId: selectedStudentId,
        limit: '1000', // Fetch all records for calendar display. For very active students, this might need pagination.
      });

      const response = await apiFetch(
        `/api/reports/attendance/student?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }

      return response.json();
    },
    enabled: !!selectedStudentId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Parse attendance dates
  const attendedDates = useMemo(() => {
    if (!attendanceData?.data) return [];
    return attendanceData.data.map((record) => new Date(record.sessionDate));
  }, [attendanceData]);

  // Calculate monthly statistics
  const monthlyAttendanceCount = useMemo(() => {
    if (!attendedDates.length) return 0;
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    return attendedDates.filter(
      (date) => date >= monthStart && date <= monthEnd
    ).length;
  }, [attendedDates, currentMonth]);

  // Clear student search
  const clearStudentSearch = () => {
    setStudentSearchQuery('');
  };

  return (
    <Card>
      <CardHeader>
        <CardToolbar>
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                className="pl-8"
              />
              {studentSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={clearStudentSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Select
              value={selectedStudentId}
              onValueChange={(value) => {
                setSelectedStudentId(value);
              }}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {studentsData?.map((student) => (
                  <SelectItem key={String(student.id)} value={String(student.id)}>
                    {student.firstName} {student.lastName || ''} ({student.registrationNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardToolbar>
      </CardHeader>
      {selectedStudentId ? (
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading attendance data...
            </div>
          ) : (
            <div className="space-y-4">
              {/* Student Info */}
              {attendanceData?.student && (
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">
                    {attendanceData.student.firstName} {attendanceData.student.lastName || ''}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Registration No: </span>
                    {attendanceData.student.registrationNo}
                  </div>
                  {attendanceData.student.courseName && (
                    <div>
                      <span className="font-medium">Course: </span>
                      {attendanceData.student.courseName}
                    </div>
                  )}
                </div>
              )}

              {/* Calendar */}
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  modifiers={{
                    attended: attendedDates,
                  }}
                  modifiersClassNames={{
                    attended: 'bg-green-600 text-white hover:bg-green-700',
                  }}
                  className="rounded-md border"
                />
              </div>

              {/* Monthly Statistics */}
              <div className="text-center text-sm text-muted-foreground">
                <span className="font-medium">Classes attended in {format(currentMonth, 'MMMM yyyy')}: </span>
                {monthlyAttendanceCount}
              </div>

              {/* Total Statistics */}
              {attendanceData?.pagination && (
                <div className="text-center text-sm text-muted-foreground">
                  <span className="font-medium">Total classes attended (all time): </span>
                  {attendanceData.pagination.total}
                </div>
              )}

              {/* Empty state */}
              {attendanceData && attendanceData.data.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No attendance records found for this student
                </div>
              )}
            </div>
          )}
        </CardContent>
      ) : (
        <CardContent>
          <div className="p-8 text-center text-muted-foreground">
            Please select a student to view their attendance calendar
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default StudentAttendanceCalendar;
