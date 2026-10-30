'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import FitnessSkillEditDialog from './fitness-skill-edit-dialog';
import FitnessSkillDeleteDialog from './fitness-skill-delete-dialog';
import FitnessSkillGroupDeleteDialog from './fitness-skill-group-delete-dialog';

type FitnessSkill = {
  id: number;
  name: string;
  fitnessCategoryId: number;
  fitnessCategory?: { id: number; name: string };
  unitOfMeasurement: string;
  createdAt: string;
};

interface FitnessSkillListProps {
  apiBasePath?: string;
  queryKey?: string;
}

const FitnessSkillList = ({
  apiBasePath = '/api/administration/fitness-skills',
  queryKey = 'admin-fitness-skills',
}: FitnessSkillListProps) => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [editFitnessSkill, setEditFitnessSkill] = useState<FitnessSkill | null>(
    null,
  );
  const [deleteFitnessSkill, setDeleteFitnessSkill] =
    useState<FitnessSkill | null>(null);
  const [deleteFitnessSkillIds, setDeleteFitnessSkillIds] = useState<string[]>(
    [],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchFitnessSkills = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<FitnessSkill>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(categoryFilter !== 'all' ? { categoryId: categoryFilter } : {}),
    });

    const response = await apiFetch(`${apiBasePath}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(
        "Oops! Something didn't go as planned. Please try again in a moment",
      );
    }

    return response.json();
  };

  const { data: categoriesData } = useQuery({
    queryKey: ['fitness-categories-select'],
    queryFn: async () => {
      const res = await apiFetch('/api/administration/fitness-categories/select');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });
  const categories = (categoriesData ?? []) as { id: number; name: string }[];

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, pagination, sorting, searchQuery, categoryFilter],
    queryFn: () =>
      fetchFitnessSkills({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: categoryFilter !== 'all' ? [{ id: 'categoryId', value: categoryFilter }] : [],
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const columns = useMemo<ColumnDef<FitnessSkill>[]>(
    () => [
      {
        id: 'select',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        size: 60,
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Skill Name" />
        ),
        cell: (info) => info.getValue(),
        size: 200,
      },
      {
        id: 'category',
        accessorFn: (row) => row.fitnessCategory?.name ?? row.fitnessCategoryId,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Category" />
        ),
        cell: (info) => {
          const row = info.row.original;
          return <Badge variant="secondary">{row.fitnessCategory?.name ?? row.fitnessCategoryId}</Badge>;
        },
        size: 140,
      },
      {
        id: 'unitOfMeasurement',
        accessorKey: 'unitOfMeasurement',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Unit" />
        ),
        cell: (info) => info.getValue(),
        size: 100,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const skill = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary"
                onClick={() => {
                  setEditFitnessSkill(skill);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive/80 hover:text-destructive"
                onClick={() => {
                  setDeleteFitnessSkill(skill);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
        size: 100,
        enableSorting: false,
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
    getRowId: (row) => String(row.id),
  });

  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteFitnessSkillIds(selectedIds);
  }, [rowSelection, table]);

  const clearFilters = () => {
    setCategoryFilter('all');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const DataGridToolbar = () => (
    <CardHeader>
      <CardToolbar>
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fitness skills..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              className="pl-8"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => {
                  setSearchQuery('');
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          {categoryFilter !== 'all' && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
          {deleteFitnessSkillIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setGroupDeleteDialogOpen(true)}
            >
              Delete ({deleteFitnessSkillIds.length})
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setEditFitnessSkill(null);
              setEditDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Fitness Skill
          </Button>
        </div>
      </CardToolbar>
    </CardHeader>
  );

  return (
    <>
      <DataGrid
        table={table}
        recordCount={data?.pagination?.total || 0}
        isLoading={isLoading}
        tableLayout={{
          columnsResizable: true,
          columnsPinnable: true,
          columnsMovable: true,
          columnsVisibility: true,
        }}
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

      <FitnessSkillEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditFitnessSkill(null);
        }}
        fitnessSkill={editFitnessSkill}
        apiBasePath={apiBasePath}
        queryKey={queryKey}
      />

      {deleteFitnessSkill && (
        <FitnessSkillDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => {
            setDeleteDialogOpen(false);
            setDeleteFitnessSkill(null);
          }}
          fitnessSkill={deleteFitnessSkill}
          apiBasePath={apiBasePath}
          queryKey={queryKey}
        />
      )}

      <FitnessSkillGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setRowSelection({});
        }}
        fitnessSkillIds={deleteFitnessSkillIds}
        apiBasePath={apiBasePath}
        queryKey={queryKey}
      />
    </>
  );
};

export default FitnessSkillList;
