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
import { Badge } from '@/components/ui/badge';
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
import RegistrationEditDialog, { type Registration } from './registration-edit-dialog';
import RegistrationDeleteDialog from './registration-delete-dialog';
import RegistrationGroupDeleteDialog from './registration-group-delete-dialog';

type EventSelectOption = {
  id: number;
  name: string;
};

const RegistrationList = () => {
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
  const [editRegistration, setEditRegistration] = useState<Registration | null>(null);
  const [deleteRegistration, setDeleteRegistration] = useState<Registration | null>(null);
  const [deleteRegistrationIds, setDeleteRegistrationIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');

  // Fetch events for filter
  const { data: events } = useQuery({
    queryKey: ['events-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.eventManagement.events.select);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  const fetchRegistrations = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Registration>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(eventFilter !== 'all' ? { eventId: eventFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.eventManagement.registerGymnast.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      'event-registrations',
      pagination,
      sorting,
      searchQuery,
      statusFilter,
      eventFilter,
    ],
    queryFn: () =>
      fetchRegistrations({
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

  const columns: ColumnDef<Registration>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <DataGridTableRowSelectAll  />
        ),
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'student.firstName',
        id: 'student',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Student"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row?.original?.student?.firstName} {row?.original?.student?.lastName}
            </div>
            <div className="text-sm text-muted-foreground">
              {row?.original?.student?.registrationNo}
            </div>
          </div>
        ),
        meta: {
          headerTitle: 'Student',
          skeleton: <Skeleton className="w-32 h-6" />,
        },
        enableSorting: false,
      },
      {
        accessorKey: 'event.name',
        id: 'event',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Event"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.event?.name || '-'}</div>
            {row.original.event?.event_type && (
              <Badge variant="secondary" className="mt-1">
                {row.original.event.event_type}
              </Badge>
            )}
          </div>
        ),
        meta: {
          headerTitle: 'Event',
          skeleton: <Skeleton className="w-32 h-6" />,
        },
        enableSorting: false,
      },
      {
        accessorKey: 'Total',
        id: 'total',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Total"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{Number(row.original.Total).toFixed(2)}</span>
        ),
        meta: {
          headerTitle: 'Total',
          skeleton: <Skeleton className="w-20 h-6" />,
        },
        enableSorting: true,
      },
      {
        accessorKey: 'PaymentMode',
        id: 'paymentMode',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Payment Mode"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => (
          <span>{row.original.PaymentMode || '-'}</span>
        ),
        meta: {
          headerTitle: 'Payment Mode',
          skeleton: <Skeleton className="w-24 h-6" />,
        },
        enableSorting: false,
      },
      {
        accessorKey: 'depositdate',
        id: 'depositdate',
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Deposit Date"
            visibility={true}
            column={column}
          />
        ),
        cell: ({ row }) => {
          const date = row.original.depositdate;
          return date ? (
            <span>{formatDate(typeof date === 'string' ? new Date(date) : date)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
        meta: {
          headerTitle: 'Deposit Date',
          skeleton: <Skeleton className="w-24 h-6" />,
        },
        enableSorting: true,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const registration = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditRegistration(registration);
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
                  setDeleteRegistration(registration);
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

  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteRegistrationIds(selectedIds);
  }, [rowSelection, table]);

  const handleAddRegistration = () => {
    setEditRegistration(null);
    setEditDialogOpen(true);
  };

  const handleBulkDelete = () => {
    if (deleteRegistrationIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setEventFilter('all');
  };

  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search registrations..."
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
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={eventFilter}
              onValueChange={setEventFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events?.map((event: EventSelectOption) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(statusFilter !== 'all' || eventFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteRegistrationIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteRegistrationIds.length})
              </Button>
            )}
            <Button onClick={handleAddRegistration}>
              <Plus className="mr-2 h-4 w-4" />
              Register Gymnast
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
      <RegistrationEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditRegistration(null);
        }}
        registration={editRegistration}
      />

      {/* Delete Dialog */}
      <RegistrationDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteRegistration(null);
        }}
        registration={deleteRegistration}
      />

      {/* Group Delete Dialog */}
      <RegistrationGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteRegistrationIds([]);
        }}
        registrationIds={deleteRegistrationIds}
      />
    </>
  );
};

export default RegistrationList;