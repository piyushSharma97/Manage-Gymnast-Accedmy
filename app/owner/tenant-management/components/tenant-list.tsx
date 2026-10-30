'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
import { Pencil, Trash2, Plus, Search, X, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Switch, SwitchWrapper } from '@/components/ui/switch';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { LoaderCircleIcon } from 'lucide-react';

// Local dialogs
import TenantEditDialog from './tenant-edit-dialog';
import TenantDeleteDialog from './tenant-delete-dialog';

type Tenant = {
	id: number;
	academyName: string;
	academyCode: string;
	businessRegistrationNumber: string | null;
	taxId: string | null;
	website: string | null;
	logoUrl: string | null;
	primaryEmail: string;
	primaryPhone: string;
	addressLine1: string;
	addressLine2: string | null;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	timeZone: string;
	subscriptionPlanId: number;
	subscriptionStatus: 'active' | 'suspended' | 'cancelled' | 'trial';
	subscriptionStartDate: string;
	subscriptionEndDate: string;
	isActive: boolean;
	createdAt: string;
	subscriptionPlan: {
		id: number;
		planName: string;
		description: string | null;
	};
};

const TenantList = () => {
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
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
  const [deleteTenantIds, setDeleteTenantIds] = useState<string[]>([]);
  const [sendingEmailTenantId, setSendingEmailTenantId] = useState<number | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<string>('all');
  
  // Query client for invalidating queries
  const queryClient = useQueryClient();

  // Fetch tenants from the server API
  const fetchTenants = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Tenant>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(activeFilter !== 'all' ? { active: activeFilter } : {}),
      ...(subscriptionStatusFilter !== 'all' ? { subscriptionStatus: subscriptionStatusFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.tenantManagement.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Tenants query
  const { data, isLoading } = useQuery({
    queryKey: [
      'tenant-management',
      pagination,
      sorting,
      searchQuery,
      activeFilter,
      subscriptionStatusFilter,
    ],
    queryFn: () =>
      fetchTenants({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(activeFilter !== 'all' ? [{ id: 'active', value: activeFilter }] : []),
          ...(subscriptionStatusFilter !== 'all' ? [{ id: 'subscriptionStatus', value: subscriptionStatusFilter }] : []),
        ],
        searchQuery,
      }),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Mutation for toggling tenant active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ tenantId, isActive }: { tenantId: number; isActive: boolean }) => {
      const response = await apiFetch(API_PATHS.tenantManagement.byId(String(tenantId)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to update tenant status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-management'] });
    },
  });

  // Mutation for sending welcome email
  const sendWelcomeEmailMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      setSendingEmailTenantId(tenantId);
      const response = await apiFetch(API_PATHS.tenantManagement.sendWelcomeEmail(String(tenantId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to send welcome email');
      }

      return response.json();
    },
    onSuccess: () => {
      setSendingEmailTenantId(null);
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>Welcome email sent successfully</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    },
    onError: (error: Error) => {
      setSendingEmailTenantId(null);
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    },
  });

  // Handle row selection
  useEffect(() => {
    const selectedRowIds = Object.keys(rowSelection);
    if (selectedRowIds.length > 0) {
      setDeleteTenantIds(selectedRowIds);
    } else {
      setDeleteTenantIds([]);
    }
  }, [rowSelection]);

  // Column definitions
  const columns = useMemo<ColumnDef<Tenant>[]>(
    () => [
      {
        id: 'serial',
        accessorFn: (_row, index) => index + 1, // generate serial number
        header: () => 'S.No', // column header
        cell: ({ row }) => row.index + 1, // display serial number
        size: 27,
        enableSorting: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
        enableResizing: false,
      },
      {
        id: 'academyName',
        accessorKey: 'academyName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Academy Name" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="font-medium">{value}</div>;
        },
        size: 200,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Academy Name',
          skeleton: <Skeleton className="w-28 h-8" />,
        },
      },
      {
        id: 'primaryPhone',
        accessorKey: 'primaryPhone',
        header: ({ column }) => (
          <DataGridColumnHeader title="Phone" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="truncate">{value}</div>;
        },
        size: 140,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Phone',
          skeleton: <Skeleton className="w-24 h-8" />,
        },
      },
      {
        id: 'primaryEmail',
        accessorKey: 'primaryEmail',
        header: ({ column }) => (
          <DataGridColumnHeader title="Email" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="truncate">{value}</div>;
        },
        size: 200,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Email',
          skeleton: <Skeleton className="w-32 h-8" />,
        },
      },
      {
        id: 'city',
        accessorKey: 'city',
        header: ({ column }) => (
          <DataGridColumnHeader title="City" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="truncate">{value}</div>;
        },
        size: 120,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'City',
          skeleton: <Skeleton className="w-20 h-8" />,
        },
      },
      {
        id: 'subscriptionStatus',
        accessorKey: 'isActive',
        header: () => 'Active',
        cell: (info) => {
          const tenant = info.row.original;
          const isActive = tenant.isActive;
          const subscriptionExpired =
            tenant.subscriptionEndDate &&
            new Date(tenant.subscriptionEndDate) < new Date();
          // Academy is effectively inactive if subscription expired (show as Inactive to owner)
          const effectiveActive = isActive && !subscriptionExpired;

          const handleToggle = async (checked: boolean) => {
            toggleActiveMutation.mutate({
              tenantId: tenant.id,
              isActive: checked,
            });
          };

          return (
            <SwitchWrapper>
              <Switch
                checked={effectiveActive}
                onCheckedChange={handleToggle}
                disabled={toggleActiveMutation.isPending || !!subscriptionExpired}
                title={subscriptionExpired ? 'Subscription expired - renew to activate' : undefined}
              />
            </SwitchWrapper>
          );
        },
        size: 80,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Active',
          skeleton: <Skeleton className="w-10 h-8" />,
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const tenant = row.original;
          const isSendingEmail = sendingEmailTenantId === tenant.id;
          
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditTenant(tenant);
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
                  sendWelcomeEmailMutation.mutate(tenant.id);
                }}
                disabled={isSendingEmail}
                title="Send Welcome Email"
              >
                {isSendingEmail ? (
                  <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteTenant(tenant);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
        size: 130,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
      },
    ],
    [
      toggleActiveMutation,
      sendWelcomeEmailMutation,
      sendingEmailTenantId,
    ],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((column) => column.id as string),
  );

  const table = useReactTable({
    columns,
    data: data?.data || [],
    pageCount: Math.ceil((data?.pagination.total || 0) / pagination.pageSize),
    getRowId: (row: Tenant) => String(row.id),
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
              placeholder="Search Academy"
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
          <div className="flex gap-2">
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
            <Select
              disabled={isLoading && true}
              onValueChange={setSubscriptionStatusFilter}
              value={subscriptionStatusFilter}
              defaultValue="all"
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by subscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subscriptions</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CardToolbar>
         
          <Button
            disabled={isLoading && true}
            onClick={() => {
              setEditTenant(null);
              setEditDialogOpen(true);
            }}
          >
            <Plus />
            Add Academy
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

      <TenantEditDialog
        open={editDialogOpen}
        closeDialog={() => setEditDialogOpen(false)}
        tenant={editTenant}
      />

      {deleteTenant && (
        <TenantDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => setDeleteDialogOpen(false)}
          tenant={deleteTenant}
        />
      )}
    </>
  );
};

export default TenantList;
