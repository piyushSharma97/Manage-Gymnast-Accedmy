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
import { Search, X, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api';
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
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AttendanceReportStudent = {
  studentId: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  courseId: number;
  courseName: string | null;
  locationId: number;
  classesAttended: number;
  feesPaidInMonth: number | null;
  feesPaidDateInMonth: string | null;
  invoiceNumber: string | null;
};

const AttendanceReportList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'registrationNo', desc: false },
  ]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  
  // Calculate previous month by default (YYYY-MM format)
  const getPreviousMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed, so previous month is current - 1
    const previousMonth = month === 0 ? 11 : month - 1;
    const previousYear = month === 0 ? year - 1 : year;
    return `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}`;
  };

  const [billingMonth, setBillingMonth] = useState<string>(getPreviousMonth());

  // Fetch locations for filter
  const { data: locationsData } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/location/select?active=true');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch report data
  const fetchReportData = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<AttendanceReportStudent>> => {
    const sortField = sorting?.[0]?.id || 'registrationNo';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
      ...(billingMonth ? { billingMonth } : {}),
    });

    const response = await apiFetch(
      `/api/reports/attendance/students?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Report data query
  const { data, isLoading } = useQuery({
    queryKey: [
      'attendance-report',
      pagination,
      sorting,
      searchQuery,
      locationFilter,
      billingMonth,
    ],
    queryFn: () =>
      fetchReportData({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [],
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const value = `${year}-${String(month).padStart(2, '0')}`;
      const label = format(date, 'MMMM yyyy');
      options.push({ value, label });
    }
    return options;
  };

  const monthOptions = getMonthOptions();

  // Table columns definition
  const columns: ColumnDef<AttendanceReportStudent>[] = useMemo(
    () => [
      {
        accessorKey: 'registrationNo',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Registration Number" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return <span className="font-medium">{student.registrationNo}</span>;
        },
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span>
              {student.firstName} {student.lastName || ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'courseName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return <span>{student.courseName || '-'}</span>;
        },
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Phone Number" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return <span>{student.phone || '-'}</span>;
        },
      },
      {
        accessorKey: 'classesAttended',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Classes Attended" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span className="font-medium">
              {student.classesAttended || 0}
            </span>
          );
        },
      },
      {
        accessorKey: 'feesPaidInMonth',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Fees Paid in Month" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span className="font-medium">
              {student.feesPaidInMonth !== null ? student.feesPaidInMonth.toFixed(2) : '-'}
            </span>
          );
        },
      },
      {
        accessorKey: 'invoiceNumber',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Invoice Number" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span className={student.invoiceNumber ? 'font-medium' : 'text-muted-foreground'}>
              {student.invoiceNumber || '-'}
            </span>
          );
        },
      },
      {
        accessorKey: 'feesPaidDateInMonth',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Fees Paid Date" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span>
              {student.feesPaidDateInMonth
                ? format(new Date(student.feesPaidDateInMonth), 'MMM dd, yyyy')
                : '-'}
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

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setLocationFilter('all');
    setBillingMonth(getPreviousMonth());
  };

  const hasActiveFilters = locationFilter !== 'all' || billingMonth !== getPreviousMonth();

  // Custom toolbar component
  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationsData?.map((location: any) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.centerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={billingMonth}
              onValueChange={setBillingMonth}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Billing Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
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
          <CardTable>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
    </>
  );
};

export default AttendanceReportList;

