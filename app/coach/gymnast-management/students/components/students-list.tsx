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
import { useUserSession } from '@/customHooks/userSession';
import { ExternalStudentRegistrationLink } from '@/components/gymnast-management/external-student-registration-link';

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  gender: string;
  status: string;
  joinDate: string | null;
  createdAt: string;
  team?: string | null;
  currentSkillLevelId?: string | null;
  teamName?: string | null;
  skillLevelName?: string | null;
};

const StudentsList = () => {
  const {user} = useUserSession();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

  const fetchStudents = async (params: DataGridApiFetchParams) => {
    const url = new URL('/api/coach/students', window.location.origin);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('sort', params.sortField || 'createdAt');
    url.searchParams.set('dir', params.sortDirection || 'desc');
    url.searchParams.set('tenantId', String(user?.tenantId ?? ''));
    url.searchParams.set('locationId', String(user?.locationId ?? ''));
    if (params.query) url.searchParams.set('query', String(params.query));
    // Status filter is always ACTIVE for coaches (enforced by API), but we still send it for consistency
    if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', String(statusFilter));

    const response = await apiFetch(url.toString());
    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }
    const data: DataGridApiResponse<Student> = await response.json();
    return data;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['coach-students', pagination, sorting, searchQuery, statusFilter],
    queryFn: () =>
      fetchStudents({
        page: (pagination.pageIndex ?? 0) + 1,
        limit: pagination.pageSize,
        sortField: sorting[0]?.id || 'createdAt',
        sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
        query: searchQuery,
        pageIndex: 0,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5000,
  });

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        accessorKey: 'registrationNo',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Reg. No" />,
      },
      {
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        id: 'name',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
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
        accessorKey: 'team',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Team" />,
        cell: ({ row }) => row.original.teamName || '-',
      },
      {
        accessorKey: 'currentSkillLevelId',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Skill" />,
        size:80,
        cell: ({ row }) => row.original.skillLevelName || '-',
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        size:60,
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <span className={`text-sm ${
              status === 'ACTIVE' ? 'text-green-600' : 
              status === 'INACTIVE' ? 'text-gray-600' : 
              'text-red-600'
            }`}>
              {status}
            </span>
          );
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
    state: { pagination, sorting },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ACTIVE');
  };

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
            {/* Status filter hidden for coaches - only active students are shown */}
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:ml-auto sm:w-auto">
            <ExternalStudentRegistrationLink />
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
    </>
  );
};

export default StudentsList;

