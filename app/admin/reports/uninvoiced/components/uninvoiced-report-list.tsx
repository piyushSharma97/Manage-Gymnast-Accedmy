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
import { Search, X } from 'lucide-react';
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
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type UninvoicedStudentRecord = {
  enrollmentId: string;
  studentId: string;
  registrationNo: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  programName: string | null;
  courseName: string | null;
  batchId: number;
  locationId: number;
  locationName: string;
  enrollmentStart: string | null;
  paymentCycle: string | null;
};

const UninvoicedReportList = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'enrollmentStart', desc: true },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  const { data: locationsData } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/location/select?active=true');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const fetchReportData = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<
    DataGridApiResponse<UninvoicedStudentRecord>
  > => {
    const sortField = sorting?.[0]?.id || 'enrollmentStart';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
    });

    const response = await apiFetch(
      `/api/reports/uninvoiced/students?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something went wrong while loading the report. Please try again.',
      );
    }

    return response.json();
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      'uninvoiced-report',
      pagination,
      sorting,
      searchQuery,
      locationFilter,
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
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const columns: ColumnDef<UninvoicedStudentRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'registrationNo',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Registration Number" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.registrationNo}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Student" />
        ),
        cell: ({ row }) => {
          const student = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {student.firstName} {student.lastName}
              </span>
              {student.phone && (
                <span className="text-muted-foreground text-xs">
                  {student.phone}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'programName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Program" />
        ),
        cell: ({ row }) => (
          <span>{row.original.programName || '—'}</span>
        ),
      },
      {
        accessorKey: 'courseName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course" />
        ),
        cell: ({ row }) => (
          <span>{row.original.courseName || '—'}</span>
        ),
      },
      {
        accessorKey: 'locationName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => (
          <span>{row.original.locationName || '—'}</span>
        ),
      },
      {
        accessorKey: 'paymentCycle',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Payment Cycle" />
        ),
        cell: ({ row }) =>
          row.original.paymentCycle ? (
            <Badge variant="outline">{row.original.paymentCycle}</Badge>
          ) : (
            <span>—</span>
          ),
      },
      {
        accessorKey: 'enrollmentStart',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Enrolled On" />
        ),
        cell: ({ row }) => {
          const date = row.original.enrollmentStart;
          return date ? format(new Date(date), 'MMM dd, yyyy') : '—';
        },
      },
    ],
    [],
  );

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

  const clearSearch = () => setSearchQuery('');

  const DataGridToolbar = () => (
    <CardHeader>
      <CardToolbar>
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, registration no, course..."
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
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All locations" />
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
        </div>
      </CardToolbar>
    </CardHeader>
  );

  return (
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
  );
};

export default UninvoicedReportList;


