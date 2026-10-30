'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Program } from '@/app/models/program';
import ProgramDeleteDialog from './program-delete-dialog';
import ProgramEditDialog from './program-edit-dialog';
import ProgramGroupDeleteDialog from './program-group-delete-dialog';

const ProgramList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Form state management
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [editProgram, setEditProgram] = useState<Program | null>(null);
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null);
  const [deleteProgramIds, setDeleteProgramIds] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch programs from the server API
  const fetchPrograms = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Program>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(selectedStatus && selectedStatus !== 'all'
        ? { isActive: selectedStatus }
        : {}),
    });

    const response = await apiFetch(
      `/api/program?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didnt go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Programs query
  const { data, isLoading } = useQuery({
    queryKey: [
      'programs',
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      searchQuery,
      selectedStatus,
    ],
    queryFn: () =>
      fetchPrograms({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
    placeholderData: keepPreviousData,
  });

  const queryClient = useQueryClient();
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ program, isActive }: { program: Program; isActive: boolean }) => {
      const response = await apiFetch(`/api/program/${program.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: program.name,
          code: program.code ?? '',
          description: program.description ?? '',
          ageMin: program.ageMin ?? undefined,
          ageMax: program.ageMax ?? undefined,
          durationWeeks: program.durationWeeks ?? undefined,
          sessionType: program.sessionType ?? '',
          isActive,
        }),
      });
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to update program status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });

  // Define columns
  const columns: ColumnDef<Program>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <DataGridTableRowSelectAll />
        ),
        size:60,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Program Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue('name') as string;
          return <div className="font-medium">{name}</div>;
        },
      },
      {
        accessorKey: 'ageMin',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Age Range" />
        ),
        cell: ({ row }) => {
          const ageMin = row.getValue('ageMin') as number;
          const ageMax = row.original.ageMax;
          if (ageMin || ageMax) {
            return <div>{ageMin || '?'} - {ageMax || '?'} years</div>;
          }
          return <div className="text-muted-foreground">-</div>;
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const program = row.original;
          const handleToggle = (checked: boolean) => {
            toggleStatusMutation.mutate({ program, isActive: checked });
          };
          return (
            <Switch
              checked={program.isActive}
              onCheckedChange={handleToggle}
              size="sm"
              disabled={toggleStatusMutation.isPending}
            />
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => {
          const date = row.getValue('createdAt') as Date;
          return <div>{new Date(date).toLocaleDateString()}</div>;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const program = row.original;

          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditProgram(program);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>

              {/* Edit button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteProgram(program);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              ><Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [toggleStatusMutation],
  );

  // Table configuration
  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      pagination,
      sorting,
      rowSelection,
    },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
  });

  // Handle search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    setSelectedStatus(value === 'all' ? null : value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Handle add new program
  const handleAddProgram = () => {
    setEditProgram(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const programIds = selectedRows.map((row) => String(row.original.id));
    setDeleteProgramIds(programIds);
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Get selected rows count
  const selectedRowsCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardToolbar>
            <div className="flex flex-1 items-center space-x-2">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search programs..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-8 w-[300px]"
                  />
                </div>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="h-8 px-2 lg:px-3"
                  >
                    Clear
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Select
                  value={selectedStatus || 'all'}
                  onValueChange={handleStatusFilter}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {selectedRowsCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  Delete Selected ({selectedRowsCount})
                </Button>
              )}
              <Button onClick={handleAddProgram}>
                <Plus className="mr-2 h-4 w-4" />
                Add Program
              </Button>
            </div>
          </CardToolbar>
        </CardHeader>
         <CardTable>
           <ScrollArea className="h-[500px] w-full">
             {isLoading ? (
               <div className="space-y-3 p-4">
                 {Array.from({ length: 5 }).map((_, i) => (
                   <div key={i} className="flex items-center space-x-4">
                     <Skeleton className="h-4 w-4" />
                     <Skeleton className="h-4 w-[200px]" />
                     <Skeleton className="h-4 w-[100px]" />
                     <Skeleton className="h-4 w-[120px]" />
                     <Skeleton className="h-4 w-[60px]" />
                   </div>
                 ))}
               </div>
             ) : (
               <DataGrid table={table} recordCount={data?.pagination?.total || 0}>
                 <DataGridTable />
               </DataGrid>
             )}
             <ScrollBar orientation="horizontal" />
           </ScrollArea>
         </CardTable>
         <CardFooter>
           <DataGrid table={table} recordCount={data?.pagination?.total || 0}>
             <DataGridPagination  />
           </DataGrid>
         </CardFooter>
      </Card>

      {/* Edit Dialog */}
      <ProgramEditDialog
        open={editDialogOpen}
        closeDialog={() => setEditDialogOpen(false)}
        program={editProgram}
      />

      {/* Delete Dialog */}
      {deleteProgram && (
        <ProgramDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => setDeleteDialogOpen(false)}
          program={deleteProgram}
        />
      )}

      {/* Group Delete Dialog */}
      <ProgramGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => setGroupDeleteDialogOpen(false)}
        programIds={deleteProgramIds}
      />
    </>
  );
};

export default ProgramList;
