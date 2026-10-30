'use client';

import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { CalendarDays, Search, X } from 'lucide-react';
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
import { DataGrid, DataGridApiFetchParams, DataGridApiResponse } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type BirthdayStudent = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  gender: string;
  status: string;
  dob: string | null;
  createdAt: string;
};

const BirthdaysList = () => {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');

  const fetchBirthdays = async (params: DataGridApiFetchParams) => {
    const sortField = params.sorting?.[0]?.id || 'createdAt';
    const sortDirection = params.sorting?.[0]?.desc ? 'desc' : 'asc';
    const searchParams = new URLSearchParams({
      page: String((params.pageIndex ?? 0) + 1),
      limit: String(params.pageSize),
      sort: sortField,
      dir: sortDirection,
      range,
      ...(params.searchQuery ? { query: params.searchQuery } : {}),
    });
    const response = await apiFetch(withParams(API_PATHS.gymnastManagement.birthdays, searchParams));
    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }
    const data: DataGridApiResponse<BirthdayStudent> = await response.json();
    return data;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-birthdays', pagination, sorting, searchQuery, range],
    queryFn: () =>
      fetchBirthdays({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<BirthdayStudent>[] = useMemo(
    () => [
      {
        accessorKey: 'registrationNo',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Reg. No" />,
      },
      {
        accessorKey: 'firstName',
        header: ({ column }) => <DataGridColumnHeader column={column} title="First Name" />,
      },
      {
        accessorKey: 'lastName',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Last Name" />,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Email" />,
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Phone" />,
      },
      {
        accessorKey: 'gender',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Gender" />,
      },
      {
        accessorKey: 'dob',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Date of Birth" />,
        cell: ({ row }) => {
          const dob = row.getValue('dob') as string | null;
          return dob ? new Date(dob).toLocaleDateString() : '-';
        },
      },
    ],
    [],
  );

  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex items-center gap-2">
            <div className="relative w-[280px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={range} onValueChange={(v) => setRange(v as 'today' | 'week' | 'month')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => setRange('today')}>
              <CalendarDays className="mr-2 h-4 w-4" /> Today
            </Button>
          </div>
        </CardToolbar>
      </CardHeader>
    );
  };

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { pagination, sorting, rowSelection },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: false,
  });

  return (
    <DataGrid
      table={table}
      recordCount={data?.pagination?.total || 0}
      isLoading={isLoading}
      tableLayout={{ columnsResizable: true, columnsPinnable: true, columnsMovable: true, columnsVisibility: true }}
      tableClassNames={{ edgeCell: 'px-5' }}
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

export default BirthdaysList;


