'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Pencil, Search, Trash2, X, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import {useUserSession} from '@/customHooks/userSession';

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

const SiblingsList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const {user} =useUserSession();
  const userLocationId = Number(user?.locationId) || null;


  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchSiblings = async (params: any) => {
    const url = new URL('/api/manager/students/siblings', window.location.origin);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('sort', params.sortField || 'createdAt');
    url.searchParams.set('dir', params.sortDirection || 'desc');
    url.searchParams.set('locationId', String(userLocationId));
    if (params.query) url.searchParams.set('query', params.query);
    if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', statusFilter);

    const response = await apiFetch(url.toString());
    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }
    const data: DataGridApiResponse<Student> = await response.json();
    return data;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-siblings', pagination, sorting, searchQuery, statusFilter],
    queryFn: () =>
      fetchSiblings({
        page: (pagination.pageIndex ?? 0) + 1,
        limit: pagination.pageSize,
        sortField: sorting[0]?.id || 'createdAt',
        sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
        query: searchQuery,
      }),
    placeholderData: (previousData) => previousData,
  });

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
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
        size: 80,
        cell: ({ row }) => row.original.skillLevelName || '-',
      },
      {
        id: 'statusToggle',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        size: 60,
        cell: ({ row }) => {
          const student = row.original;
          const isActive = student.status === 'ACTIVE';
          const toggle = async () => {
            const newStatus = isActive ? 'INACTIVE' : 'ACTIVE';
            const res = await apiFetch(`/api/manager/students/${student.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ['admin-siblings'] });
            }
          };
          return (
            <Switch checked={isActive} onCheckedChange={toggle} />
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const student = row.original;
          return (
            <div className="flex items-center gap-1">
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/gymnast-management/students/${student.id}`);
                }}
                title="Edit"
              >
                <Pencil className="h-2 w-2" />
              </Button>
            
            </div>
          );
        },
      },
    ],
    [router, queryClient],
  );

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
    enableRowSelection: true,
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
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
                placeholder="Search siblings..."
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
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

export default SiblingsList;

