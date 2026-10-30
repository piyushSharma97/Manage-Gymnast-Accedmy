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
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { formatDate } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTable, CardToolbar } from '@/components/ui/card';
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
import EventEditDialog, { type Event } from './event-edit-dialog';
import EventDeleteDialog from './event-delete-dialog';
import EventGroupDeleteDialog from './event-group-delete-dialog';

const EventList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startdate', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Form state management
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null);
  const [deleteEventIds, setDeleteEventIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.location.select);
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
  });
  console.log('Locations data:', locations);
  // Fetch events from the server API
  const fetchEvents = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Event>> => {
    const sortField = sorting?.[0]?.id || 'startdate';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize ?? 10),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.eventManagement.events.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Events query
  const { data, isLoading } = useQuery({
    queryKey: [
      'events',
      pagination,
      sorting,
      searchQuery,
      locationFilter,
    ],
    queryFn: () =>
      fetchEvents({
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
console.log('Event data:', data);
  // Table columns definition
  const columns: ColumnDef<Event>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <DataGridTableRowSelectAll />
        ),
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Name"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        meta: {
          headerTitle: 'Name',
          skeleton: <Skeleton className="w-32 h-6" />,
        },
        enableSorting: true,
      },
      {
        accessorKey: 'startdate',
        id: 'startdate',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Start Date"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => {
          const date = row.original.startdate;
          return <span>{formatDate(typeof date === 'string' ? new Date(date) : date)}</span>;
        },
        meta: {
          headerTitle: 'Start Date',
          skeleton: <Skeleton className="w-24 h-6" />,
        },
        enableSorting: true,
      },
      {
        accessorKey: 'enddate',
        id: 'enddate',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="End Date"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => {
          const date = row.original.enddate;
          return <span>{formatDate(typeof date === 'string' ? new Date(date) : date)}</span>;
        },
        meta: {
          headerTitle: 'End Date',
          skeleton: <Skeleton className="w-24 h-6" />,
        },
        enableSorting: true,
      },
      {
        accessorKey: 'fees',
        id: 'fees',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Fees"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <span>{row.original.fees.toFixed(2)}</span>
        ),
        meta: {
          headerTitle: 'Fees',
          skeleton: <Skeleton className="w-20 h-6" />,
        },
        enableSorting: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const event = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditEvent(event);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="h-2 w-2" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteEvent(event);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
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
    setDeleteEventIds(selectedIds);
  }, [rowSelection, table]);

  // Handle add new event
  const handleAddEvent = () => {
    setEditEvent(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (deleteEventIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setLocationFilter('all');
  };

  // Custom toolbar component
  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-6 w-6 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map((location: import('@/types/domain').LocationSelectOption) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.centerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {locationFilter !== 'all' && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteEventIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteEventIds.length})
              </Button>
            )}
            <Button onClick={handleAddEvent}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
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
      <EventEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditEvent(null);
        }}
        event={editEvent}
      />

      {/* Delete Dialog */}
      <EventDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteEvent(null);
        }}
        event={deleteEvent}
      />

      {/* Group Delete Dialog */}
      <EventGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteEventIds([]);
        }}
        eventIds={deleteEventIds}
      />
    </>
  );
};

export default EventList;
