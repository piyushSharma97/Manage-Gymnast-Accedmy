'use client';

import { useState } from 'react';
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
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from '@/components/ui/card';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import FitnessCategoryEditDialog from './fitness-category-edit-dialog';
import FitnessCategoryDeleteDialog from './fitness-category-delete-dialog';

type FitnessCategory = { id: number; name: string; createdAt: string | null; updatedAt: string | null };

export default function FitnessCategoryList() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FitnessCategory | null>(null);

  const params = new URLSearchParams({
    page: String(pagination.pageIndex + 1),
    limit: String(pagination.pageSize),
    sort: sorting[0]?.id || 'name',
    dir: sorting[0]?.desc ? 'desc' : 'asc',
    ...(searchQuery ? { query: searchQuery } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-fitness-categories', pagination, sorting, searchQuery],
    queryFn: async () => {
      const res = await apiFetch(`${API_PATHS.administration.fitnessCategories.list}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<FitnessCategory>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => <DataGridColumnHeader column={column} title="Category Name" />,
      cell: (info) => info.getValue(),
      size: 400,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const cat = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => { setSelectedCategory(cat); setEditOpen(true); }}
              title="Edit"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive/80 hover:text-destructive"
              onClick={() => { setSelectedCategory(cat); setDeleteOpen(true); }}
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
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { pagination, sorting },
    pageCount: data?.pagination?.total ? Math.ceil(data.pagination.total / pagination.pageSize) : -1,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => String(row.id),
  });

  return (
    <>
      <DataGrid
        table={table}
        recordCount={data?.pagination?.total ?? 0}
        isLoading={isLoading}
        tableLayout={{ columnsResizable: true, columnsVisibility: true }}
        tableClassNames={{ edgeCell: 'px-5' }}
      >
        <Card>
          <CardHeader>
            <CardToolbar>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPagination((p) => ({ ...p, pageIndex: 0 })); }}
                  className="pl-8"
                />
                {searchQuery && (
                  <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-full" onClick={() => { setSearchQuery(''); setPagination((p) => ({ ...p, pageIndex: 0 })); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button size="sm" onClick={() => { setSelectedCategory(null); setEditOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Category
              </Button>
            </CardToolbar>
          </CardHeader>
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
      <FitnessCategoryEditDialog open={editOpen} closeDialog={() => { setEditOpen(false); setSelectedCategory(null); }} category={selectedCategory} queryKey="admin-fitness-categories" />
      {selectedCategory && (
        <FitnessCategoryDeleteDialog open={deleteOpen} closeDialog={() => { setDeleteOpen(false); setSelectedCategory(null); }} category={selectedCategory} queryKey="admin-fitness-categories" />
      )}
    </>
  );
}
