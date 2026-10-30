'use client';

import {  useMemo, useState } from 'react';
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
import { Pencil, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
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
import BatchEditDialog from './batch-edit-dialog';

type Batch = {
  id: number;
  studentId: string;
  programId: number;
  courseId: number;
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
  coachId: number | null;
  isActive: boolean;
  paymentCycle: string;
  amount: number;
  program: {
    id: number;
    name: string;
  };
  course: {
    id: number;
    courseName: string;
    courseCode: string;
  };
  coach: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNo: string;
  } | null;
  tenant: {
    id: number;
    academyName: string;
  };
};

const BatchList = () => {
  // List state management
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  // Form state management
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [createBatchForStudent, setCreateBatchForStudent] = useState<{ studentId: string; locationId: number } | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [coachFilter, setCoachFilter] = useState<string>('all');

  // Fetch batches from the server API
  const fetchBatches = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Batch>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(programFilter !== 'all' ? { programId: programFilter } : {}),
      ...(courseFilter !== 'all' ? { courseId: courseFilter } : {}),
      ...(coachFilter !== 'all' ? { coachId: coachFilter } : {}),
    });

    const response = await apiFetch(
      withParams(API_PATHS.batch.list, params),
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Batches query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-batches',
      pagination,
      sorting,
      searchQuery,
      programFilter,
      courseFilter,
      coachFilter,
    ],
    queryFn: () =>
      fetchBatches({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(programFilter !== 'all' ? [{ id: 'programId', value: programFilter }] : []),
          ...(courseFilter !== 'all' ? [{ id: 'courseId', value: courseFilter }] : []),
          ...(coachFilter !== 'all' ? [{ id: 'coachId', value: coachFilter }] : []),
        ],
        searchQuery,
      }),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });


  // Table columns definition
  const columns: ColumnDef<Batch>[] = useMemo(
    () => [
      {
        id: 'serialNo',
        header: 'S.No',
        size: 60,
        minSize: 60,
        maxSize: 60,
        cell: ({ row, table }) => {
          const pageIndex = table.getState().pagination.pageIndex;
          const pageSize = table.getState().pagination.pageSize;
          return (
            <span className="text-sm">
              {pageIndex * pageSize + row.index + 1}
            </span>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'student',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Student Name" />
        ),
        cell: ({ row }) => {
          const batch = row.original;
          return (
            <span className="font-medium">
              {batch.student 
                ? `${batch.student.firstName} ${batch.student.lastName}`
                : 'Unknown Student'}
            </span>
          );
        },
      },
      {
        accessorKey: 'course',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course" />
        ),
        cell: ({ row }) => {
          const batch = row.original;
          return (
            <span>
              {batch.course.courseName} 
            </span>
          );
        },
      },
      {
        accessorKey: 'monday',
        header: 'Mon',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.monday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'tuesday',
        header: 'Tue',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.tuesday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'wednesday',
        header: 'Wed',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.wednesday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'thursday',
        header: 'Thu',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.thursday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'friday',
        header: 'Fri',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.friday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'saturday',
        header: 'Sat',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.saturday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'sunday',
        header: 'Sun',
        size: 80,
        minSize: 80,
        maxSize: 80,
        cell: ({ row }) => {
          const batch = row.original;
          return <span>{batch.sunday || '-'}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: 'coach',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Coach" />
        ),
        cell: ({ row }) => {
          const batch = row.original;
          return (
            <span>
              {batch.coach ? `${batch.coach.firstName}` : '-'}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const batch = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditBatch(batch);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>

              {/* Add new batch for student */}
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  // Fetch student to get location
                  try {
                    const studentResponse = await apiFetch(API_PATHS.student.byId(batch.studentId));
                    if (studentResponse.ok) {
                      const studentData = await studentResponse.json();
                      setCreateBatchForStudent({
                        studentId: batch.studentId,
                        locationId: studentData.location?.id || 0,
                      });
                      setEditDialogOpen(true);
                    }
                  } catch (error) {
                    console.error('Failed to fetch student:', error);
                  }
                }}
                title="Add New Batch"
              ><Plus className="h-4 w-4" />
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
    state: {
      pagination,
      sorting,
    },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: false,
  });

  // Handle add new batch
  const handleAddBatch = () => {
    setEditBatch(null);
    setEditDialogOpen(true);
  };


  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
   
    setProgramFilter('all');
    setCourseFilter('all');
    setCoachFilter('all');
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
                placeholder="Search batches..."
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
              value={courseFilter}
              onValueChange={setCourseFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {/* TODO: Add course options */}
              </SelectContent>
            </Select>
            <Select
              value={coachFilter}
              onValueChange={setCoachFilter}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Coach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Coaches</SelectItem>
                {/* TODO: Add coach options */}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(programFilter !== 'all' || courseFilter !== 'all' || coachFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            <Button onClick={handleAddBatch}>
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
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
      <BatchEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditBatch(null);
          setCreateBatchForStudent(null);
        }}
        batch={editBatch}
        createBatchForStudent={createBatchForStudent}
      />

    </>
  );
};

export default BatchList;
