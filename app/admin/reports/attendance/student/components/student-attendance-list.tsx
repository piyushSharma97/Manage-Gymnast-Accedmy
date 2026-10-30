'use client';

import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from '@/components/ui/card';
import {
  DataGrid,
  DataGridApiFetchParams,
  DataGridApiResponse,
} from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import {
  DataGridTable,
} from '@/components/ui/data-grid-table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  phone: string | null;
  courseName: string | null;
};

type FilterFormValues = {
  locationId: string;
  studentId: string;
};

const StudentAttendanceList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sessionDate', desc: true },
  ]);

  // Form management
  const form = useForm<FilterFormValues>({
    defaultValues: {
      locationId: '',
      studentId: '',
    },
  });

  const selectedLocationId = form.watch('locationId');
  const selectedStudentId = form.watch('studentId');

  // Fetch locations for selection
  const { data: locationsData } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.location.selectActive);
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch students based on selected location
  const { data: studentsData } = useQuery({
    queryKey: ['students-select', selectedLocationId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedLocationId) {
        params.set('locationId', selectedLocationId);
      }
      params.set('status', 'ACTIVE');
      const response = await apiFetch(`/api/student/select?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      return response.json();
    },
    enabled: !!selectedLocationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch attendance data for selected student
  const fetchAttendanceData = async ({
    pageIndex,
    pageSize,
    sorting,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<AttendanceRecord> & { student?: StudentInfo }> => {
    if (!selectedStudentId) {
      return {
        data: [],
        empty: true,
        pagination: { total: 0, page: 1 },
      };
    }

    const sortField = sorting?.[0]?.id || 'sessionDate';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      studentId: selectedStudentId,
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.reports.attendance.student, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Attendance data query
  const { data, isLoading } = useQuery({
    queryKey: [
      'student-attendance',
      pagination,
      sorting,
      selectedStudentId,
    ],
    queryFn: () =>
      fetchAttendanceData({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [],
        searchQuery: '',
      }),
    enabled: !!selectedStudentId,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Table columns definition
  const columns: ColumnDef<AttendanceRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'sessionDate',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Session Date" />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <span>
              {format(new Date(record.sessionDate), 'MMM dd, yyyy')}
            </span>
          );
        },
      },
      {
        accessorKey: 'locationName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return <span>{record.locationName}</span>;
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Recorded At" />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <span>
              {format(new Date(record.createdAt), 'MMM dd, yyyy HH:mm')}
            </span>
          );
        },
      },
    ],
    []
  );

  // Table instance
  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      pagination,
      sorting,
    },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
  });

  // Get selected student display name
  const selectedStudent = studentsData?.find(
    (s: { id: string | number }) => String(s.id) === selectedStudentId
  );

  // Custom toolbar component
  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <Form {...form}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 w-full">
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('studentId', '');
                          setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locationsData?.map((location: any) => (
                            <SelectItem
                              key={String(location.id)}
                              value={String(location.id)}
                            >
                              {location.centerName || location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
                        }}
                        disabled={!selectedLocationId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a student" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentsData?.map((student: import('@/types/domain').StudentSelectOption) => (
                            <SelectItem key={String(student.id)} value={String(student.id)}>
                              {student.firstName} {student.lastName || ''} ({student.registrationNo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              {selectedStudent && data?.student && (
                <div className="md:col-span-2 text-sm text-muted-foreground">
                  <span className="font-medium">Total Classes: </span>
                  {data.pagination.total}
                  {data.student.courseName && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="font-medium">Course: </span>
                      {data.student.courseName}
                    </>
                  )}
                </div>
              )}
            </div>
          </Form>
        </CardToolbar>
      </CardHeader>
    );
  };

  return (
    <>
      <DataGrid
        table={table}
        recordCount={data?.pagination.total || 0}
        isLoading={isLoading}
        tableLayout={{
          columnsResizable: true,
          columnsPinnable: true,
          columnsMovable: true,
          columnsVisibility: true,
        }}
        tableClassNames={{
          edgeCell: 'px-5',
        }}
      >
        <Card>
          <DataGridToolbar />
          {selectedStudentId ? (
            <>
              <CardTable>
                <ScrollArea>
                  <DataGridTable />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardTable>
              <CardFooter>
                <DataGridPagination />
              </CardFooter>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {!selectedLocationId 
                ? 'Please select a location to view students'
                : 'Please select a student to view their attendance records'}
            </div>
          )}
        </Card>
      </DataGrid>
    </>
  );
};

export default StudentAttendanceList;