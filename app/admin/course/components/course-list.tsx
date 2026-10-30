'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

// Local dialogs
import CourseEditDialog from './course-edit-dialog';
import CourseDeleteDialog from './course-delete-dialog';
import CourseGroupDeleteDialog from './course-group-delete-dialog';

type Course = {
  id: number;
  programId: number;
  courseName: string;
  courseCode: string;
  sportCategoryId: number;
  classFrequency: number;
  perClass: number;
  monthly: number;
  quarterly: number;
  halfYearly: number;
  shortDescription: string | null;
  isActive: boolean;
  createdAt: string;
  program: {
    id: number;
    name: string;
  };
  tenant: {
    id: number;
    academyName: string;
  };
};

const CourseList = () => {
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
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);
  const [deleteCourseIds, setDeleteCourseIds] = useState<string[]>([]);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [sportCategoryFilter, setSportCategoryFilter] = useState<string>('all');

  // Fetch courses from the server API
  const fetchCourses = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Course>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize ?? 10),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(activeFilter !== 'all' ? { active: activeFilter } : {}),
      ...(programFilter !== 'all' ? { programId: programFilter } : {}),
      ...(sportCategoryFilter !== 'all' ? { sportCategoryId: sportCategoryFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.course.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Courses query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-courses',
      pagination,
      sorting,
      searchQuery,
      activeFilter,
      programFilter,
      sportCategoryFilter,
    ],
    queryFn: () =>
      fetchCourses({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(activeFilter !== 'all' ? [{ id: 'active', value: activeFilter }] : []),
          ...(programFilter !== 'all' ? [{ id: 'programId', value: programFilter }] : []),
          ...(sportCategoryFilter !== 'all' ? [{ id: 'sportCategoryId', value: sportCategoryFilter }] : []),
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

  // Mutation for toggling course status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ courseId, isActive }: { courseId: number; isActive: boolean }) => {
      const response = await apiFetch(API_PATHS.course.byId(String(courseId)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to update course status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
  });

  // Handle row selection
  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => String(row.original.id));
    setDeleteCourseIds(selectedIds);
  }, [rowSelection]);

  // Table columns definition
  const columns: ColumnDef<Course>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <DataGridTableRowSelectAll />
        ),
        size:60,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'courseName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course Name" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{course.courseName}</span>
              <span className="text-sm text-muted-foreground">
                {course.courseCode}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'classFrequency',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Frequency" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          return <span>{course.classFrequency} classes/week</span>;
        },
      },
      {
        accessorKey: 'monthly',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Monthly" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          const amount = typeof course.monthly === 'number' ? course.monthly : parseFloat(String(course.monthly)) || 0;
          return <span>{amount.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'quarterly',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Quarterly" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          const amount = typeof course.quarterly === 'number' ? course.quarterly : parseFloat(String(course.quarterly)) || 0;
          return <span>{amount.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'halfYearly',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Half Yearly" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          const amount = typeof course.halfYearly === 'number' ? course.halfYearly : parseFloat(String(course.halfYearly)) || 0;
          return <span>{amount.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          
          const handleToggle = (checked: boolean) => {
            toggleStatusMutation.mutate({ courseId: course.id, isActive: checked });
          };

          return (
            <Switch
              checked={course.isActive}
              onCheckedChange={handleToggle}
              size="sm"
              disabled={toggleStatusMutation.isPending}
            />
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => {
          const course = row.original;
          return (
            <span>
              {new Date(course.createdAt).toLocaleDateString()}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const course = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditCourse(course);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>

              {/* Edit button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteCourse(course);
                  setDeleteDialogOpen(true);
                }}
                title="Delete"
              ><Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [toggleStatusMutation]
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

  // Handle add new course
  const handleAddCourse = () => {
    setEditCourse(null);
    setEditDialogOpen(true);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (deleteCourseIds.length === 0) return;
    setGroupDeleteDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setActiveFilter('all');
    setProgramFilter('all');
    setSportCategoryFilter('all');
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
                placeholder="Search courses..."
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
              value={programFilter}
              onValueChange={setProgramFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                {/* TODO: Add program options */}
              </SelectContent>
            </Select>
            <Select
              value={sportCategoryFilter}
              onValueChange={setSportCategoryFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sport Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {/* TODO: Add sport category options */}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(activeFilter !== 'all' || programFilter !== 'all' || sportCategoryFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {deleteCourseIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                Delete ({deleteCourseIds.length})
              </Button>
            )}
            <Button onClick={handleAddCourse}>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
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
      <CourseEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditCourse(null);
        }}
        course={editCourse}
      />

      {/* Delete Dialog */}
      <CourseDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteCourse(null);
        }}
        course={deleteCourse}
      />

      {/* Group Delete Dialog */}
      <CourseGroupDeleteDialog
        open={groupDeleteDialogOpen}
        closeDialog={() => {
          setGroupDeleteDialogOpen(false);
          setDeleteCourseIds([]);
        }}
        courseIds={deleteCourseIds}
      />
    </>
  );
};

export default CourseList;
