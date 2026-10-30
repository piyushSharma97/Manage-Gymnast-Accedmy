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
import { Ellipsis, Search, X, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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
import StudentEditDialog from '../../gymnasts/components/gymnast-edit-dialog';

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

const InactiveGymnastList = () => {
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchInactiveStudents = async (params: DataGridApiFetchParams) => {
    const url = new URL('/api/manager/gymnast-management/inactive', window.location.origin);
    const sortField = params.sorting?.[0]?.id || 'createdAt';
    const sortDirection = params.sorting?.[0]?.desc ? 'desc' : 'asc';
    url.searchParams.set('page', String((params.pageIndex ?? 0) + 1));
    url.searchParams.set('limit', String(params.pageSize));
    url.searchParams.set('sort', sortField);
    url.searchParams.set('dir', sortDirection);
    if (params.searchQuery) url.searchParams.set('query', params.searchQuery);

    const response = await apiFetch(url.toString());
    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }
    const data: DataGridApiResponse<Student> = await response.json();
    return data;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inactive-students', pagination, sorting, searchQuery],
    queryFn: () =>
      fetchInactiveStudents({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => <DataGridTableRowSelectAll />,
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
          const status = row.getValue('status') as string;
          const statusColors: Record<string, string> = {
            ACTIVE: 'bg-green-100 text-green-800',
            INACTIVE: 'bg-gray-100 text-gray-800',
            BLOCKED: 'bg-red-100 text-red-800',
          };
          return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: 'joinDate',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Join Date" />,
        cell: ({ row }) => {
          const date = row.getValue('joinDate') as string | null;
          return date ? new Date(date).toLocaleDateString() : '-';
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

  const clearFilters = () => {
    setSearchQuery('');
  };

  const handleExport = async () => {
    // Fetch all records by paging through the API
    const pageSize = 100;
    let currentPage = 1;
    let total = 0;
    const allRows: Student[] = [];

    do {
      const url = new URL('/api/mamager/gymnast-management/inactive', window.location.origin);
      url.searchParams.set('page', String(currentPage));
      url.searchParams.set('limit', String(pageSize));
      url.searchParams.set('sort', 'createdAt');
      url.searchParams.set('dir', 'desc');
      if (searchQuery) url.searchParams.set('query', searchQuery);

      const resp = await apiFetch(url.toString());
      if (!resp.ok) {
        const { message } = await resp.json();
        throw new Error(message || 'Failed to fetch data for export');
      }
      const json = await resp.json();
      const rows: Student[] = json?.data ?? [];
      total = json?.pagination?.total ?? rows.length;
      allRows.push(...rows);
      currentPage += 1;
    } while (allRows.length < total);

    // Build CSV content
    const headers = [
      'Registration No',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Gender',
      'Status',
      'Join Date',
      'Created At',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [headers.join(',')];
    for (const r of allRows) {
      lines.push(
        [
          escapeCsv(r.registrationNo),
          escapeCsv(r.firstName),
          escapeCsv(r.lastName),
          escapeCsv(r.email),
          escapeCsv(r.phone),
          escapeCsv(r.gender),
          escapeCsv(r.status),
          escapeCsv(r.joinDate ? new Date(r.joinDate).toLocaleDateString() : ''),
          escapeCsv(r.createdAt ? new Date(r.createdAt).toLocaleString() : ''),
        ].join(','),
      );
    }

    const csvBlob = new Blob(["\ufeff" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inactive-students-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
                placeholder="Search inactive students..."
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
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
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
          queryClient.invalidateQueries({ queryKey: ['admin-inactive-students'] });
        }}
        student={editStudent}
      />

    </>
  );
};

export default InactiveGymnastList;

