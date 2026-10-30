'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
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

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  tenantName: string | null;
  skillLevelName: string | null;
  teamName: string | null;
  createdAt: string;
};

type Tenant = {
  id: number;
  academyName: string;
};

type Location = {
  id: number;
  centerName: string;
  tenantId: number;
};

const StudentsPage = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch tenants for filter dropdown
  const { data: tenantsData } = useQuery({
    queryKey: ['owner-tenants-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/tenant-management/select?active=true');
      if (!response.ok) {
        throw new Error('Failed to fetch Academy');
      }
      return response.json() as Promise<Tenant[]>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch locations for filter dropdown (filtered by selected tenant)
  const { data: locationsData } = useQuery({
    queryKey: ['owner-locations-select', tenantFilter],
    queryFn: async () => {
      const url = tenantFilter !== 'all' 
        ? API_PATHS.owner.locations.selectWithTenant(tenantFilter)
        : API_PATHS.owner.locations.select;
      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      return response.json() as Promise<Location[]>;
    },
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch students from the server API
  const fetchStudents = async ({
    pageIndex = 0,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Student>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(tenantFilter !== 'all' ? { tenantId: tenantFilter } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.owner.students, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Students query
  const { data, isLoading } = useQuery({
    queryKey: [
      'owner-students',
      pagination,
      sorting,
      searchQuery,
      tenantFilter,
      locationFilter,
      statusFilter,
    ],
    queryFn: () =>
      fetchStudents({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(tenantFilter !== 'all' ? [{ id: 'tenantId', value: tenantFilter }] : []),
          ...(locationFilter !== 'all' ? [{ id: 'locationId', value: locationFilter }] : []),
          ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
        ],
        searchQuery,
      }),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Reset location filter when tenant filter changes
  useEffect(() => {
    if (tenantFilter === 'all') {
      setLocationFilter('all');
    } else {
      // Optionally reset location filter when tenant changes
      setLocationFilter('all');
    }
  }, [tenantFilter]);

  // Column definitions
  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: 'serial',
        accessorFn: (_row, index) => index + 1,
        header: () => 'S.No',
        cell: ({ row }) => row.index + 1 + pagination.pageIndex * pagination.pageSize,
        size: 60,
        enableSorting: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
        enableResizing: false,
      },
      {
        id: 'tenantName',
        accessorKey: 'tenantName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Academy Name" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return <div className="font-medium">{value || '-'}</div>;
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
        id: 'studentName',
        accessorFn: (row) => `${row.firstName} ${row.lastName || ''}`.trim(),
        header: ({ column }) => (
          <DataGridColumnHeader title="Student Name" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="font-medium">{value}</div>;
        },
        size: 200,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Student Name',
          skeleton: <Skeleton className="w-32 h-8" />,
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataGridColumnHeader title="Phone" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return <div className="truncate">{value || '-'}</div>;
        },
        size: 150,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Phone',
          skeleton: <Skeleton className="w-24 h-8" />,
        },
      },
      {
        id: 'skillLevelName',
        accessorKey: 'skillLevelName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Skill Level" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return <div className="truncate">{value || '-'}</div>;
        },
        size: 150,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Skill Level',
          skeleton: <Skeleton className="w-24 h-8" />,
        },
      },
      {
        id: 'teamName',
        accessorKey: 'teamName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Team" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string | null;
          return <div className="truncate">{value || '-'}</div>;
        },
        size: 150,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Team',
          skeleton: <Skeleton className="w-24 h-8" />,
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title="Status" column={column} />
        ),
        cell: (info) => {
          const status = info.getValue() as string;
          const statusColors = {
            ACTIVE: 'primary',
            INACTIVE: 'secondary',
            BLOCKED: 'destructive',
          } as const;
          
          return (
            <Badge variant={statusColors[status as keyof typeof statusColors] || 'secondary'}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </Badge>
          );
        },
        size: 120,
        enableSorting: true,
        enableHiding: false,
        meta: {
          headerTitle: 'Status',
          skeleton: <Skeleton className="w-20 h-8" />,
        },
      },
    ],
    [pagination.pageIndex, pagination.pageSize],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((column) => column.id as string),
  );

  const table = useReactTable({
    columns,
    data: data?.data || [],
    pageCount: Math.ceil((data?.pagination.total || 0) / pagination.pageSize),
    getRowId: (row: Student) => String(row.id),
    state: {
      pagination,
      sorting,
      columnOrder,
    },
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
              placeholder="Search students"
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
                onClick={() => {
                  setInputValue('');
                  setSearchQuery('');
                }}
              >
                <X />
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              disabled={isLoading && true}
              onValueChange={setTenantFilter}
              value={tenantFilter}
              defaultValue="all"
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by tenant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Academy</SelectItem>
                {tenantsData?.map((tenant) => (
                  <SelectItem key={tenant.id} value={String(tenant.id)}>
                    {tenant.academyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              disabled={isLoading && true || tenantFilter === 'all'}
              onValueChange={setLocationFilter}
              value={locationFilter}
              defaultValue="all"
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locationsData?.map((location) => (
                  <SelectItem key={location.id} value={String(location.id)}>
                    {location.centerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              disabled={isLoading && true}
              onValueChange={setStatusFilter}
              value={statusFilter}
              defaultValue="all"
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
    </>
  );
};

export default StudentsPage;

