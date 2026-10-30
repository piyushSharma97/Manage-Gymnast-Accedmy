'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Local dialogs
import SkillEditDialog from './skill-edit-dialog';
import SkillDeleteDialog from './skill-delete-dialog';
import SkillGroupDeleteDialog from './skill-group-delete-dialog';

type Skill = {
  id: number;
  apparatus_id: number;
  apparatus_name: string;
  name: string;
  gender: string;
  color: string | null;
  level: string | null;
  status: string;
  createdat: string;
};

const SkillList = () => {
  const queryClient = useQueryClient();

  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdat', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Form state management
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [deleteSkill, setDeleteSkill] = useState<Skill | null>(null);
  const [deleteSkillIds, setDeleteSkillIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [apparatusFilter, setApparatusFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Fetch skills from the server API
  const fetchSkills = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Skill>> => {
    const sortField = sorting?.[0]?.id || 'createdat';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(apparatusFilter !== 'all' ? { apparatusId: apparatusFilter } : {}),
      ...(genderFilter !== 'all' ? { gender: genderFilter } : {}),
    });

    const response = await apiFetch(
      `/api/skills?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Skills query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-skills',
      pagination,
      sorting,
      searchQuery,
      statusFilter,
      apparatusFilter,
      genderFilter,
    ],
    queryFn: () =>
      fetchSkills({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
          ...(apparatusFilter !== 'all' ? [{ id: 'apparatusId', value: apparatusFilter }] : []),
          ...(genderFilter !== 'all' ? [{ id: 'gender', value: genderFilter }] : []),
        ],
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Fetch apparatus for filter
  const { data: apparatusList } = useQuery({
    queryKey: ['apparatus-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/apparatus/select?active=true');
      if (!response.ok) throw new Error('Failed to fetch apparatus');
      return response.json();
    },
  });

  // Mutation for toggling skill status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ skillId, newStatus }: { skillId: number; newStatus: string }) => {
      const response = await apiFetch(`/api/skills/${skillId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to update skill status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-skills'] });
    },
  });

  // Table columns definition
  const columns: ColumnDef<Skill>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <DataGridTableRowSelectAll />
        ),
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        size: 60,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Skill Name" />
        ),
        cell: ({ row }) => {
          const skill = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{skill.name}</span>
              {skill.level && (
                <span className="text-sm text-muted-foreground">
                  Level: {skill.level}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'apparatus_name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Apparatus" />
        ),
        cell: ({ row }) => {
          const skill = row.original;
          return <span>{skill.apparatus_name}</span>;
        },
      },
      {
        accessorKey: 'gender',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Gender" />
        ),
        cell: ({ row }) => {
          const skill = row.original;
          return <span>{skill.gender}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const skill = row.original;
          const isActive = skill.status === 'active';
          
          const handleToggle = (checked: boolean) => {
            const newStatus = checked ? 'active' : 'inactive';
            toggleStatusMutation.mutate({ skillId: skill.id, newStatus });
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
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const skill = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                onClick={() => {
                  setEditSkill(skill);
                  setEditDialogOpen(true);
                }}
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary"
              >
                <Pencil className="size-4" />
              </Button>

              <Button
                onClick={() => {
                  setDeleteSkill(skill);
                  setDeleteDialogOpen(true);
                }}
                variant="ghost"
                size="icon"
                className="size-8 text-destructive/80 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [toggleStatusMutation]
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
    enableRowSelection: true,
  });

  // Handle row selection
  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteSkillIds(selectedIds);
  }, [rowSelection, table]);

  // Handle add new skill
  const handleAddSkill = () => {
    setEditSkill(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (deleteSkillIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Reset pagination when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };
  // Clear filters
  const clearFilters = () => {
    setStatusFilter('all');
    setApparatusFilter('all');
    setGenderFilter('all');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Reset pagination when filters change
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };
  const handleApparatusFilterChange = (value: string) => {
    setApparatusFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };
  const handleGenderFilterChange = (value: string) => {
    setGenderFilter(value);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };
  // DataGrid Toolbar
  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={handleClearSearch}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={apparatusFilter} onValueChange={handleApparatusFilterChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Apparatus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apparatus</SelectItem>
                {apparatusList?.map((apparatus: import('@/types/domain').ApparatusSelectOption) => (
                  <SelectItem key={apparatus.id} value={apparatus.id.toString()}>
                    {apparatus.shortName || apparatus.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={genderFilter} onValueChange={handleGenderFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Gender</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(statusFilter !== 'all' || apparatusFilter !== 'all' || genderFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteSkillIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteSkillIds.length})
              </Button>
            )}
            {/* <Button size="sm" onClick={handleAddSkill}>
              <Plus className="mr-2 h-4 w-4" />
              Add Skill
            </Button> */}
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

      {/* Edit Dialog */}
      <SkillEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditSkill(null);
        }}
        skill={editSkill}
      />

      {/* Delete Dialog */}
      <SkillDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteSkill(null);
        }}
        skill={deleteSkill}
      />

      {/* Group Delete Dialog */}
      <SkillGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteSkillIds([]);
        }}
        skillIds={deleteSkillIds}
      />
    </>
  );
};

export default SkillList;

