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
import { Pencil, Trash2, Plus, Search, X, ExternalLink } from 'lucide-react';
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
} from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import ParentYoutubeLinkEditDialog from './parent-youtube-link-edit-dialog';
import ParentYoutubeLinkDeleteDialog from './parent-youtube-link-delete-dialog';

type ParentYoutubeLink = {
  id: number;
  link: string;
  title: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  createdAt: string;
};

interface ParentYoutubeLinkListProps {
  apiBasePath?: string;
  queryKey?: string;
}

const ParentYoutubeLinkList = ({
  apiBasePath = '/api/administration/parent-youtube-links',
  queryKey = 'admin-parent-youtube-links',
}: ParentYoutubeLinkListProps) => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editLink, setEditLink] = useState<ParentYoutubeLink | null>(null);
  const [deleteLink, setDeleteLink] = useState<ParentYoutubeLink | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchLinks = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<ParentYoutubeLink>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
    });

    const response = await apiFetch(`${apiBasePath}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(
        "Oops! Something didn't go as planned. Please try again in a moment",
      );
    }

    return response.json();
  };

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, pagination, sorting, searchQuery],
    queryFn: () =>
      fetchLinks({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const columns: ColumnDef<ParentYoutubeLink>[] = [
    {
      id: 'link',
      accessorKey: 'link',
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Video" />
      ),
      cell: (info) => {
        const row = info.row.original;
        const link = row.link;
        const title = row.title || link;
        return (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline truncate max-w-[320px]"
          >
            <i
              className="ki-solid ki-youtube text-[#FF0000] text-lg shrink-0"
              aria-hidden
            />
            <span className="truncate">{title}</span>
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
          </a>
        );
      },
      size: 360,
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Description" />
      ),
      cell: (info) => {
        const value = info.getValue() as string | null;
        return (
          <div className="truncate max-w-[280px]">{value || '-'}</div>
        );
      },
      size: 280,
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Added" />
      ),
      cell: (info) => {
        const value = info.getValue() as string;
        return new Date(value).toLocaleDateString();
      },
      size: 100,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const link = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-primary"
              onClick={() => {
                setEditLink(link);
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
                setDeleteLink(link);
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
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: {
      pagination,
      sorting,
    },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
    getRowId: (row) => String(row.id),
  });

  const DataGridToolbar = () => (
    <CardHeader>
      <CardToolbar>
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search links or description..."
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
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={() => {
              setEditLink(null);
              setEditDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add YouTube Link
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

      <ParentYoutubeLinkEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditLink(null);
        }}
        parentYoutubeLink={editLink}
        apiBasePath={apiBasePath}
        queryKey={queryKey}
      />

      {deleteLink && (
        <ParentYoutubeLinkDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => {
            setDeleteDialogOpen(false);
            setDeleteLink(null);
          }}
          parentYoutubeLink={deleteLink}
          apiBasePath={apiBasePath}
          queryKey={queryKey}
        />
      )}
    </>
  );
};

export default ParentYoutubeLinkList;
