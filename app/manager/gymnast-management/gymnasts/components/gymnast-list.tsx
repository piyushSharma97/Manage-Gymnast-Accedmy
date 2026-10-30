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
import { Ellipsis, Plus, Search, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import StudentEditDialog from './gymnast-edit-dialog';
import StudentDeleteDialog from './gymnast-delete-dialog';

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  gender: string;
  status: string;
  joinDate: string | null;
  createdAt: string;
};

const GymnastList = () => {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchStudents = async (params: DataGridApiFetchParams) => {
    const url = new URL('/api/manager/students', window.location.origin);
    url.searchParams.set('page', String(params.page));
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('sort', params.sortField ?? 'createdAt');
    url.searchParams.set('dir', params.sortDirection ?? 'desc');
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
    queryKey: ['admin-students', pagination, sorting, searchQuery, statusFilter],
    queryFn: () =>
      fetchStudents({
        page: (pagination.pageIndex ?? 0) + 1,
        limit: pagination.pageSize,
        sortField: sorting[0]?.id || 'createdAt',
        sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
        query: searchQuery,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => <DataGridTableRowSelectAll  />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
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
        accessorKey: 'status',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.original.status;
          const variant = 
            status === 'ACTIVE' ? 'success' : 
            status === 'INACTIVE' ? 'secondary' : 
            'destructive';
          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const student = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditStudent(student);
                    setEditDialogOpen(true);
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setDeleteStudent(student);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
    setEditStudent(null);
    setEditDialogOpen(true);
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
          <div className="ml-auto flex items-center gap-2">
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

      <StudentEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditStudent(null);
          queryClient.invalidateQueries({ queryKey: ['admin-students'] });
        }}
        student={editStudent}
      />

      <StudentDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteStudent(null);
          queryClient.invalidateQueries({ queryKey: ['admin-students'] });
        }}
        student={deleteStudent}
      />
    </>
  );
};

export default GymnastList;