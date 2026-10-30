'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Plus, Search, X, UserPlus, Pencil, Trash } from 'lucide-react';
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

// Local dialogs
import TrialEditDialog from './trial-edit-dialog';
import TrialDeleteDialog from './trial-delete-dialog';
import TrialGroupDeleteDialog from './trial-group-delete-dialog';
import { useRouter } from 'next/navigation';

type Trial = {
  id: number;
  participantName: string;
  parentName: string | null;
  phone: string | null;
  trialDate: string;
  trialTime: string;
  gender: string | null;
  isRegistered: boolean;
  email: string | null;
  type: string | null;
  age: number | null;
  instructor: string | null;
  other: string | null;
  createdAt: string;
  tenant: {
    id: number;
    academyName: string;
  };
  location?: {
    id: number;
    centerName: string;
  };
};

const TrialList = () => {
  const router = useRouter();

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
  // const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [editTrial, setEditTrial] = useState<Trial | null>(null);
  const [deleteTrial, setDeleteTrial] = useState<Trial | null>(null);
  const [deleteTrialIds, setDeleteTrialIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [registeredFilter, setRegisteredFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');

  // Fetch trials from the server API
  const fetchTrials = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Trial>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(registeredFilter !== 'all' ? { registered: registeredFilter } : {}),
      ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
      ...(genderFilter !== 'all' ? { gender: genderFilter } : {}),
    });

    const response = await apiFetch(
      `/api/manager/trial?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Trials query
  const { data, isLoading } = useQuery({
    queryKey: [
      'manager-trials',
      pagination,
      sorting,
      searchQuery,
      registeredFilter,
      typeFilter,
      genderFilter,
    ],
    queryFn: () =>
      fetchTrials({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(registeredFilter !== 'all' ? [{ id: 'registered', value: registeredFilter }] : []),
          ...(typeFilter !== 'all' ? [{ id: 'type', value: typeFilter }] : []),
          ...(genderFilter !== 'all' ? [{ id: 'gender', value: genderFilter }] : []),
        ],
        searchQuery,
      }),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Handle row selection
  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteTrialIds(selectedIds);
  }, [rowSelection]);

  // Table columns definition
  const columns: ColumnDef<Trial>[] = useMemo(
    () => [
      {
        id: 'sequence',
        header: '#',
        size: 60,
        cell: ({ row }) => row.index + 1,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'participantName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Participant" />
        ),

        cell: ({ row }) => {
          const trial = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{trial.participantName}</span>
              {trial.parentName && (
                <span className="text-sm text-muted-foreground">
                  Parent: {trial.parentName}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'trialDate',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Trial Date" />
        ),
        cell: ({ row }) => {
          const trial = row.original;
          return (
            <div className="flex flex-col">
              <span>{new Date(trial.trialDate).toLocaleDateString()}</span>
              {trial.trialTime && (
                <span className="text-sm text-muted-foreground">
                  {trial.trialTime.split('T')[1]?.slice(0, 5) || trial.trialTime.slice(0, 5)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'age',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Age" />
        ),
        size: 70,
        cell: ({ row }) => {
          const trial = row.original;
          return <span>{trial.age || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'gender',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Gender" />
        ),
        cell: ({ row }) => {
          const trial = row.original;
          return <span>{trial.gender || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => {
          const trial = row.original;
          return <span>{trial.type || 'N/A'}</span>;
        },
      },
      {
        accessorKey: 'isRegistered',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Registered" />
        ),
        cell: ({ row }) => {
          const trial = row.original;
          return (
            <Badge variant={trial.isRegistered ? 'primary' : 'secondary'}>
              {trial.isRegistered ? 'Yes' : 'No'}
            </Badge>
          );
        },
      },

      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const trial = row.original;
          const handleRegister = () => {
            // Build URL with trial data as query params
            const params = new URLSearchParams();
            console.log('params',params)
            params.set('trialId', String(trial.id));
            if (trial.participantName) {
              params.set('firstName', trial.participantName);
            }
            if (trial.parentName) {
              // Split parent name into first and last name if possible
              const parentNameParts = trial.parentName.trim().split(/\s+/);
              params.set('guardianFirstName', parentNameParts[0] || '');
              if (parentNameParts.length > 1) {
                params.set('guardianLastName', parentNameParts.slice(1).join(' '));
              }
            }
            if (trial.phone) {
              params.set('phone', trial.phone);
            }
            if (trial.email) {
              params.set('email', trial.email);
            }
            router.push(`/manager/gymnast-management/student/new?${params.toString()}`);
          };

          return (
            <div className="flex items-center gap-1">
              {/* Register button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRegister}
                disabled={trial.isRegistered}
                title="Register"
              >
                <UserPlus className="h-2 w-2" />
              </Button>

              {/* Edit button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditTrial(trial);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="h-2 w-2" />
              </Button>

              {/* Delete button */}
              {/* <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteTrial(trial);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash className="h-4 w-4 text-destructive" />
              </Button> */}
            </div>
          );

        },
      },
    ],
    [router]
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

  // Handle add new trial
  const handleAddTrial = () => {
    setEditTrial(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (deleteTrialIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setRegisteredFilter('all');
    setTypeFilter('all');
    setGenderFilter('all');
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
                placeholder="Search trials..."
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
              value={registeredFilter}
              onValueChange={setRegisteredFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Registered</SelectItem>
                <SelectItem value="false">Trial Only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Free Trial">Free Trial</SelectItem>
                <SelectItem value="Paid Trial">Paid Trial</SelectItem>
                <SelectItem value="Demo">Demo</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={genderFilter}
              onValueChange={setGenderFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(registeredFilter !== 'all' || typeFilter !== 'all' || genderFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteTrialIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteTrialIds.length})
              </Button>
            )}
            <Button onClick={handleAddTrial}>
              <Plus className="mr-2 h-4 w-4" />
              Add Trial
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
      <TrialEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditTrial(null);
        }}
        trial={editTrial}
      />

      {/* Delete Dialog */}
      {/* <TrialDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteTrial(null);
        }}
        trial={deleteTrial}
      /> */}

      {/* Group Delete Dialog */}
      <TrialGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteTrialIds([]);
        }}
        trialIds={deleteTrialIds}
      />
    </>
  );
};

export default TrialList;

