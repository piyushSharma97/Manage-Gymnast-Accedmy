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
import { DateRange } from 'react-day-picker';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type FeesReportStudent = {
  studentId: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  courseId: number;
  courseName: string | null;
  locationId: number;
  locationName: string;
  lastFeesPaid: number;
  lastFeesDate: string;
};

const FeesReportList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'lastFeesDate', desc: true },
  ]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<FeesReportStudent>> => {
    const sortField = sorting?.[0]?.id || 'lastFeesDate';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
      ...(dateRange?.from ? { startDate: dateRange.from.toISOString().split('T')[0] } : {}),
      ...(dateRange?.to ? { endDate: dateRange.to.toISOString().split('T')[0] } : {}),
    });

    const response = await apiFetch(
      `/api/reports/fees/students?${params.toString()}`,
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
      'fees-report',
      pagination,
      sorting,
      searchQuery,
      locationFilter,
      dateRange,
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

  // Table columns definition
  const columns: ColumnDef<FeesReportStudent>[] = useMemo(
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
        accessorKey: 'lastFeesPaid',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Last Fees Paid" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span className="font-medium">
              {student.lastFeesPaid.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: 'lastFeesDate',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Last Fees Date" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <span>
              {student.lastFeesDate
                ? format(new Date(student.lastFeesDate), 'MMM dd, yyyy')
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

  // Handle date range apply
  const handleDateRangeApply = () => {
    setDateRange(tempDateRange);
    setIsDatePickerOpen(false);
  };

  // Handle date range reset
  const handleDateRangeReset = () => {
    setTempDateRange(undefined);
    setDateRange(undefined);
    setIsDatePickerOpen(false);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setLocationFilter('all');
    setDateRange(undefined);
    setTempDateRange(undefined);
  };

  const hasActiveFilters = locationFilter !== 'all' || dateRange !== undefined;

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
            <Popover 
              open={isDatePickerOpen} 
              onOpenChange={(open) => {
                setIsDatePickerOpen(open);
                if (open) {
                  // Initialize temp date range with current date range when opening
                  setTempDateRange(dateRange);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    'w-[280px] justify-start text-left font-normal',
                    !dateRange && 'text-muted-foreground'
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'LLL dd, y')} -{' '}
                        {format(dateRange.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(dateRange.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={tempDateRange?.from || dateRange?.from}
                  selected={tempDateRange}
                  onSelect={setTempDateRange}
                  numberOfMonths={2}
                />
                <div className="flex items-center justify-end gap-1.5 border-t border-border p-3">
                  <Button variant="outline" onClick={handleDateRangeReset}>
                    Reset
                  </Button>
                  <Button onClick={handleDateRangeApply}>Apply</Button>
                </div>
              </PopoverContent>
            </Popover>
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

export default FeesReportList;

