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
import { Team } from '@/app/models/team';
import TeamDeleteDialog from './team-delete-dialog';
import TeamEditDialog from './team-edit-dialog';
import TeamGroupDeleteDialog from './team-group-delete-dialog';

const TeamList = () => {
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
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [deleteTeamIds, setDeleteTeamIds] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch teams from the server API
  const fetchTeams = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Team>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(selectedStatus && selectedStatus !== 'all'
        ? { status: selectedStatus }
        : {}),
    });

    const response = await apiFetch(
      `/api/team?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didnt go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Teams query
  const { data, isLoading } = useQuery({
    queryKey: [
      'teams',
      pagination.pageIndex,
      pagination.pageSize,
      sorting,
      searchQuery,
      selectedStatus,
    ],
    queryFn: () =>
      fetchTeams({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5000,
  });

  const queryClient = useQueryClient();
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ team, status }: { team: Team; status: string }) => {
      const response = await apiFetch(`/api/team/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: team.name, status }),
      });
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to update team status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  // Define columns
  const columns: ColumnDef<Team>[] = useMemo(
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
          <DataGridColumnHeader column={column} title="Team Name" />
        ),
        cell: ({ row }) => {
          const name = row.getValue('name') as string;
          return <div className="font-medium">{name}</div>;
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const team = row.original;
          const isActive = team.status === 'Active';
          const handleToggle = (checked: boolean) => {
            toggleStatusMutation.mutate({
              team,
              status: checked ? 'Active' : 'Inactive',
            });
          };
          return (
            <Switch
              checked={isActive}
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
          const team = row.original;

          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditTeam(team);
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
                  setDeleteTeam(team);
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

  // Handle add new team
  const handleAddTeam = () => {
    setEditTeam(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const teamIds = selectedRows.map((row) => String(row.original.id));
    setDeleteTeamIds(teamIds);
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
                    placeholder="Search teams..."
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
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
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
              <Button onClick={handleAddTeam}>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
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
      <TeamEditDialog
        open={editDialogOpen}
        closeDialog={() => setEditDialogOpen(false)}
        team={editTeam}
      />

      {/* Delete Dialog */}
      {deleteTeam && (
        <TeamDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => setDeleteDialogOpen(false)}
          team={deleteTeam}
        />
      )}

      {/* Group Delete Dialog */}
      <TeamGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => setGroupDeleteDialogOpen(false)}
        teamIds={deleteTeamIds}
      />
    </>
  );
};

export default TeamList;
