'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { Ellipsis, Plus, Search, Trash2, X, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
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
import { Switch } from '@/components/ui/switch';

// Local dialogs
import EmployeeEditDialog from './employee-edit-dialog';
import EmployeeDeleteDialog from './employee-delete-dialog';
import EmployeeGroupDeleteDialog from './employee-group-delete-dialog';

type Employee = {
  id: number;
  locationId: number;
  userId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: 'Coach' | 'Admin' | 'Manager' | 'Staff';
  hiredDate: string | null;
  isActive: boolean;
  createdAt: string;
  roleId?: number;
  location: {
    id: number;
    centerName: string;
  };
  tenant: {
    id: number;
    academyName: string;
  };
  employeeSkillLevels?: Array<{
    skillLevel: { id: number; levelName: string; levelCode: string };
  }>;
};

const EmployeeList = () => {
  const queryClient = useQueryClient();
  
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
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeIds, setDeleteEmployeeIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Fetch employees from the server API
  const fetchEmployees = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Employee>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(activeFilter !== 'all' ? { active: activeFilter } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
      ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.employee.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Employees query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-employees',
      pagination,
      sorting,
      searchQuery,
      activeFilter,
      locationFilter,
      roleFilter,
    ],
    queryFn: () =>
      fetchEmployees({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(activeFilter !== 'all' ? [{ id: 'active', value: activeFilter }] : []),
          ...(locationFilter !== 'all' ? [{ id: 'locationId', value: locationFilter }] : []),
          ...(roleFilter !== 'all' ? [{ id: 'role', value: roleFilter }] : []),
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
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteEmployeeIds(selectedIds);
  }, [rowSelection]);

  // Table columns definition
  const columns: ColumnDef<Employee>[] = useMemo(
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
        accessorKey: 'firstName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {employee.firstName} {employee.lastName || ''}
              </span>
              <span className="text-sm text-muted-foreground">
                {employee.email || 'No email'}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'role',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          const roleColors: Record<string, string> = {
            'Admin': 'bg-blue-100 text-blue-800',
            'Manager': 'bg-amber-100 text-amber-800',
            'Coach': 'bg-green-100 text-green-800',
            'Staff': 'bg-gray-100 text-gray-800',
          };
          return (
            <Badge className={roleColors[employee.role] ?? 'bg-gray-100 text-gray-800'}>
              {employee.role}
            </Badge>
          );
        },
      },
      {
        id: 'coachSkillLevels',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Skill levels" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          const levels = employee.employeeSkillLevels;
          if (employee.role !== 'Coach') {
            return <span className="text-muted-foreground">—</span>;
          }
          if (!levels?.length) {
            return (
              <span className="text-sm text-muted-foreground">
                No skill levels mapped
              </span>
            );
          }
          return (
            <div className="flex flex-wrap gap-1 max-w-[220px]">
              {levels.map(({ skillLevel }) => (
                <Badge
                  key={skillLevel.id}
                  variant="secondary"
                  className="text-xs font-normal whitespace-nowrap"
                >
                  {skillLevel.levelName}
                </Badge>
              ))}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'location.centerName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          return <span>{employee.location.centerName}</span>;
        },
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Phone" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          return <span>{employee.phone || 'No phone'}</span>;
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const employee = row.original;
          return (
            <Switch
              checked={employee.isActive}
              onCheckedChange={async (checked) => {
                try {
                  const response = await apiFetch(API_PATHS.employee.byId(String(employee.id)), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: checked }),
                  });
                  if (response.ok) {
                    queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
                  }
                } catch (error) {
                  console.error('Failed to update employee status:', error);
                }
              }}
            />
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const employee = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditEmployee(employee);
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
                  setDeleteEmployee(employee);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
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

  // Handle add new employee
  const handleAddEmployee = () => {
    setEditEmployee(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (deleteEmployeeIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setActiveFilter('all');
    setLocationFilter('all');
    setRoleFilter('all');
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
                placeholder="Search employees..."
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
              value={activeFilter}
              onValueChange={setActiveFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={roleFilter}
              onValueChange={setRoleFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Coach">Coach</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {/* TODO: Add location options */}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(activeFilter !== 'all' || locationFilter !== 'all' || roleFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteEmployeeIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteEmployeeIds.length})
              </Button>
            )}
            <Button onClick={handleAddEmployee}>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
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
      <EmployeeEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditEmployee(null);
        }}
        employee={editEmployee}
      />

      {/* Delete Dialog */}
      <EmployeeDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteEmployee(null);
        }}
        employee={deleteEmployee}
      />

      {/* Group Delete Dialog */}
      <EmployeeGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteEmployeeIds([]);
        }}
        employeeIds={deleteEmployeeIds}
      />
    </>
  );
};

export default EmployeeList;
