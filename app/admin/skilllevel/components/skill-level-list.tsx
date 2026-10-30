'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery ,keepPreviousData} from '@tanstack/react-query';
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

// Local dialogs
import SkillLevelEditDialog from './skill-level-edit-dialog';
import SkillLevelDeleteDialog from './skill-level-delete-dialog';
import SkillLevelGroupDeleteDialog from './skill-level-group-delete-dialog';

type SkillLevel = {
	id: number;
	sportsId: number;
	levelName: string;
	levelCode: string;
	description: string | null;
	orderSequence: number;
	isActive: boolean;
	createdAt: string;
	sportsCategory: {
		id: number;
		categoryName: string;
	};
};

const SkillLevelList = () => {
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
  const [editSkillLevel, setEditSkillLevel] = useState<SkillLevel | null>(null);
  const [deleteSkillLevel, setDeleteSkillLevel] = useState<SkillLevel | null>(null);
  const [deleteSkillLevelIds, setDeleteSkillLevelIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sportsFilter, setSportsFilter] = useState<string>('all');

  // Fetch skill levels from the server API
  const fetchSkillLevels = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<SkillLevel>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(activeFilter !== 'all' ? { active: activeFilter } : {}),
      ...(sportsFilter !== 'all' ? { sportsId: sportsFilter } : {}),
    });

    const response = await apiFetch(
      `/api/administration/skilllevel?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Skill levels query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-skill-levels',
      pagination,
      sorting,
      searchQuery,
      activeFilter,
      sportsFilter,
    ],
    queryFn: () =>
      fetchSkillLevels({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(activeFilter !== 'all' ? [{ id: 'active', value: activeFilter }] : []),
          ...(sportsFilter !== 'all' ? [{ id: 'sportsId', value: sportsFilter }] : []),
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

  // Handle row selection
  useEffect(() => {
    const selectedRowIds = Object.keys(rowSelection);
    if (selectedRowIds.length > 0) {
      setDeleteSkillLevelIds(selectedRowIds);
    } else {
      setDeleteSkillLevelIds([]);
    }
  }, [rowSelection]);

  // Column definitions
  const columns = useMemo<ColumnDef<SkillLevel>[]>(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        size: 27,
        enableSorting: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
        enableResizing: false,
      },
      {
        id: 'sportsCategory',
        accessorKey: 'sportsCategory.categoryName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Sport" column={column} />
        ),
        cell: (info) => {
          const category = info.row.original.sportsCategory;
          return <div className="font-medium">{category.categoryName}</div>;
        },
        size: 150,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerTitle: 'Sport',
          skeleton: <Skeleton className="w-20 h-8" />,
        },
      },
      {
        id: 'levelName',
        accessorKey: 'levelName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Level Name" column={column} />
        ),
        cell: (info) => info.getValue(),
        size: 200,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Level Name',
          skeleton: <Skeleton className="w-28 h-8" />,
        },
      },
      {
        id: 'levelCode',
        accessorKey: 'levelCode',
        header: ({ column }) => (
          <DataGridColumnHeader title="Code" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <Badge variant="secondary">{value}</Badge>;
        },
        size: 100,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Code',
          skeleton: <Skeleton className="w-16 h-8" />,
        },
      },
      {
        id: 'orderSequence',
        accessorKey: 'orderSequence',
        header: ({ column }) => (
          <DataGridColumnHeader title="Order" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as number;
          return (
            <div className="text-center font-medium">
              {value}
            </div>
          );
        },
        size: 80,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Order',
          skeleton: <Skeleton className="w-12 h-8" />,
        },
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: ({ column }) => (
          <DataGridColumnHeader title="Description" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return <div className="truncate">{value || '-'}</div>;
        },
        size: 300,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerTitle: 'Description',
          skeleton: <Skeleton className="w-48 h-8" />,
        },
      },
      {
        id: 'isActive',
        accessorKey: 'isActive',
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: (info) => {
          const isActive = info.getValue() as boolean;
          return (
            <Badge variant={isActive ? 'primary' : 'secondary'}>
              {isActive ? 'Active' : 'Inactive'}
            </Badge>
          );
        },
        size: 100,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Status',
          skeleton: <Skeleton className="w-16 h-8" />,
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditSkillLevel(row.original);
                setEditDialogOpen(true);
              }}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDeleteSkillLevel(row.original);
                setDeleteDialogOpen(true);
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
        size: 90,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
      },
    ],
    [],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((column) => column.id as string),
  );

  const table = useReactTable({
    columns,
    data: data?.data || [],
    pageCount: Math.ceil((data?.pagination.total || 0) / pagination.pageSize),
    getRowId: (row: SkillLevel) => String(row.id),
    state: {
      pagination,
      sorting,
      columnOrder,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  const DataGridToolbar = () => {
    const [inputValue, setInputValue] = useState(searchQuery);

    const handleSearch = () => {
      setSearchQuery(inputValue);
      setPagination({ ...pagination, pageIndex: 0 });
    };

    return (
      <CardHeader className="flex-col flex-wrap sm:flex-row items-end items-stretch sm:items-center py-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative">
            <Search className="size-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search skill levels"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isLoading && true}
              className="ps-9 w-full sm:w-64"
            />
            {searchQuery.length > 0 && (
              <Button
                mode="icon"
                variant="dim"
                className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery('')}
              >
                <X />
              </Button>
            )}
          </div>
          <Select
            disabled={isLoading && true}
            onValueChange={setActiveFilter}
            value={activeFilter}
            defaultValue="all"
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardToolbar>
          {deleteSkillLevelIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                setGroupDeleteDialogOpen(true);
              }}
            >
              Delete {deleteSkillLevelIds.length} skill levels
            </Button>
          )}
          <Button
            disabled={isLoading && true}
            onClick={() => {
              setEditSkillLevel(null);
              setEditDialogOpen(true);
            }}
          >
            <Plus />
            Add Skill Level
          </Button>
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

      <SkillLevelEditDialog
        open={editDialogOpen}
        closeDialog={() => setEditDialogOpen(false)}
        skillLevel={editSkillLevel}
      />

      {deleteSkillLevel && (
        <SkillLevelDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => setDeleteDialogOpen(false)}
          skillLevel={deleteSkillLevel}
        />
      )}

      {deleteSkillLevelIds && (
        <SkillLevelGroupDeleteDialog
          open={groupDeleteDialogOpen}
          closeDialog={() => {
            setGroupDeleteDialogOpen(false);
            setRowSelection({});
          }}
          skillLevelIds={deleteSkillLevelIds}
        />
      )}
    </>
  );
};

export default SkillLevelList;
