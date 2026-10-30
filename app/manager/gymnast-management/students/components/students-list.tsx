'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { useSession } from "next-auth/react";
import { Pencil, Plus, Search, Trash2, X, Users, FileText, Mail } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useUserSession } from '@/customHooks/userSession';
import BulkEmailDialog from '@/app/admin/gymnast-management/students/components/bulk-email-dialog';
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
  const router = useRouter();
  const {user} = useUserSession();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { data: session } = useSession();
  console.log('Session data in StudentsList:', session);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchStudents = async (params: DataGridApiFetchParams) => {
    const url = new URL('/api/manager/students', window.location.origin);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('sort', params.sortField || 'createdAt');
    url.searchParams.set('dir', params.sortDirection || 'desc');
    url.searchParams.set('tenantId', String(user?.tenantId ?? ''));
    url.searchParams.set('locationId', String(user?.locationId ?? ''));
    if (params.query) url.searchParams.set('query', String(params.query));
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
    queryKey: ['manager-students', pagination, sorting, searchQuery, statusFilter],
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
        id: 'select',
        header: () => <DataGridTableRowSelectAll  />,
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
        accessorFn: (row) => `${row.firstName} ${row.lastName}`, // merge both fields
        id: 'name', // unique ID for the column
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
        id: 'statusToggle',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        size:60,
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
              queryClient.invalidateQueries({ queryKey: ['admin-students'] });
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
                  router.push(`/manager/gymnast-management/students/${student.id}/documents`);
                }}
                title="Documents"
              ><FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/manager/gymnast-management/students/${student.id}/sibling/new`);
                }}
                title="Add Sibling"
              ><Users className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/manager/gymnast-management/students/${student.id}`);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>
            </div>
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
    onRowSelectionChange: setRowSelection,
    state: { pagination, sorting, rowSelection },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
  });

  const handleAddStudent = () => {
    router.push('/manager/gymnast-management/students/new');
  };

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
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ExternalStudentRegistrationLink />
            <Button variant="outline" onClick={() => setBulkEmailDialogOpen(true)}>
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
            <Button onClick={handleAddStudent}>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
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

      <BulkEmailDialog
        open={bulkEmailDialogOpen}
        closeDialog={() => setBulkEmailDialogOpen(false)}
        invalidateKey={['manager-students']}
      />
    </>
  );
};

export default StudentsList;


