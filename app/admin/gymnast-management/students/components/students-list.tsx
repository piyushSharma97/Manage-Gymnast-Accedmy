'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation, keepPreviousData } from '@tanstack/react-query';
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
import { Pencil, Plus, Search, Trash2, X, Users, FileText, Download, Eye, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
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
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@/components/ui/data-grid-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StudentDeleteDialog from '../../gymnasts/components/gymnast-delete-dialog';
import SendEmailDialog from './send-email-dialog';
import BulkEmailDialog from './bulk-email-dialog';
import { useRouter } from 'next/navigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/hooks/use-tenant';
import {
  MobileChevronTrail,
  MobileEntityRow,
  MobileFormFieldCard,
  MobilePageCanvas,
  MobilePillControl,
  MobilePrimaryAction,
  MobileStackScreenHeader,
} from '@/components/mobile-pattern';
import { ExternalStudentRegistrationLink } from '@/components/gymnast-management/external-student-registration-link';

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  gender: string;
  status: string;
  joinDate: string | null;
  createdAt: string;
  team?: string | null;
  currentSkillLevelId?: string | null;
  teamName?: string | null;
  skillLevelName?: string | null;
};

export type StudentQueryParams = {
  page: number;
  limit: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  query?: string;
  statusFilter?: string;
};

export const buildStudentSearchParams = (params: StudentQueryParams) => {
  const paramObj: Record<string, string> = {
    page: String(params.page),
    limit: String(params.limit),
    sort: params.sortField || 'createdAt',
    dir: params.sortDirection || 'desc',
  };

  if (params.query?.trim().length) {
    paramObj.query = params.query.trim();
  }

  if (params.statusFilter && params.statusFilter !== 'all') {
    paramObj.status = params.statusFilter;
  }

  return new URLSearchParams(paramObj);
};

const StudentsList = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [bulkEmailDialogOpen, setBulkEmailDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchStudents = async (params: DataGridApiFetchParams) => {
    const searchParams = buildStudentSearchParams({
      page: Number(params.page ?? 1),
      limit: Number(params.limit ?? 10),
      sortField: params.sortField,
      sortDirection: params.sortDirection,
      query: typeof params.query === 'string' ? params.query : undefined,
      statusFilter,
    });
    const response = await apiFetch(withParams(API_PATHS.student.list, searchParams));
    if (!response.ok) {
      const { message } = await response.json();
      throw new Error(message);
    }
    const data: DataGridApiResponse<Student> = await response.json();
    return data;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', pagination, sorting, searchQuery, statusFilter],
    queryFn: () =>
      fetchStudents({
        page: (pagination.pageIndex ?? 0) + 1,
        limit: pagination.pageSize,
        sortField: sorting[0]?.id || 'createdAt',
        sortDirection: sorting[0]?.desc ? 'desc' : 'asc',
        query: searchQuery,
      }),
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<Student>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: 'registrationNo',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Reg. No" />,
      },
      {
        accessorFn: (row) => `${row.firstName} ${row.lastName}`, // merge both fields
        id: 'name', // unique ID for the column
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Phone" />,
      },
      {
        accessorKey: 'gender',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Gender" />,
      },
      {
        accessorKey: 'team',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Team" />,
        cell: ({ row }) => row.original.teamName || '-',
      },
      {
        accessorKey: 'currentSkillLevelId',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Skill" />,
        size:80,
        cell: ({ row }) => row.original.skillLevelName || '-',
      },
      {
        id: 'statusToggle',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        size:60,
        cell: ({ row }) => {
          const student = row.original;
          const isActive = student.status === 'ACTIVE';
          const toggle = async () => {
            const newStatus = isActive ? 'INACTIVE' : 'ACTIVE';
            const res = await apiFetch(API_PATHS.student.byId(student.id), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ['admin-students'] });
            }
          };
          return (
            <Switch checked={isActive} onCheckedChange={toggle} />
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const student = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/gymnast-management/students/${student.id}/view`);
                }}
                title="View"
              ><Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/gymnast-management/students/${student.id}/documents`);
                }}
                title="Documents"
              ><FileText className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/gymnast-management/students/${student.id}/sibling/new`);
                }}
                title="Add Sibling"
              ><Users className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/gymnast-management/students/${student.id}`);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeleteStudent(student);
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
    [],
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
    state: { pagination, sorting, rowSelection },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedStudentIds = useMemo(
    () => selectedRows.map((row) => String(row.original.id)),
    [selectedRows],
  );
  const hasSelection = selectedStudentIds.length > 0;


  const selectedStudents = useMemo(
    () => selectedRows.map((row) => row.original as Student),
    [selectedRows],
  );

  const sendLoginDetailsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.student.sendLoginDetails, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message || 'Failed to send login details');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Login details sent');
      setRowSelection({});
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleAddStudent = () => {
    router.push('/admin/gymnast-management/students/new');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const handleExport = async () => {
    // Fetch all records by paging through the API
    const pageSize = 100;
    let currentPage = 1;
    let total = 0;
    const allRows: Student[] = [];

    do {
      const searchParams = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        sort: sorting[0]?.id || 'createdAt',
        dir: sorting[0]?.desc ? 'desc' : 'asc',
        ...(searchQuery ? { query: searchQuery } : {}),
        ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const resp = await apiFetch(withParams(API_PATHS.student.list, searchParams));
      if (!resp.ok) {
        const { message } = await resp.json();
        throw new Error(message || 'Failed to fetch data for export');
      }
      const json = await resp.json();
      const rows: Student[] = json?.data ?? [];
      total = json?.pagination?.total ?? rows.length;
      allRows.push(...rows);
      currentPage += 1;
    } while (allRows.length < total);

    // Build CSV content
    const headers = [
      'Registration No',
      'First Name',
      'Last Name',
      'Phone',
      'Gender',
      'Team',
      'Skill Level',
      'Status',
      'Join Date',
      'Created At',
    ];

    const escapeCsv = (val: unknown) => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [headers.join(',')];
    for (const r of allRows) {
      lines.push(
        [
          escapeCsv(r.registrationNo),
          escapeCsv(r.firstName),
          escapeCsv(r.lastName),
          escapeCsv(r.phone),
          escapeCsv(r.gender),
          escapeCsv(r.teamName),
          escapeCsv(r.skillLevelName),
          escapeCsv(r.status),
          escapeCsv(r.joinDate ? new Date(r.joinDate).toLocaleDateString() : ''),
          escapeCsv(r.createdAt ? new Date(r.createdAt).toLocaleString() : ''),
        ].join(','),
      );
    }

    const csvBlob = new Blob(["\ufeff" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalPages =
    data?.pagination?.total != null
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : 0;
  const canPrev = pagination.pageIndex > 0;
  const canNext = totalPages > 0 && pagination.pageIndex < totalPages - 1;

  const DataGridToolbar = () => {
    return (
      <CardHeader>
        <CardToolbar>
          <div className="flex items-center gap-2">
            <div className="relative w-[280px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ExternalStudentRegistrationLink />
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => setBulkEmailDialogOpen(true)}>
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
            <Button onClick={handleAddStudent}>
              <Plus className="mr-2 h-4 w-4" /> Add Student
            </Button>
          </div>
        </CardToolbar>
      </CardHeader>
    );
  };

  if (isMobile) {
    return (
      <>
        <MobilePageCanvas>
          <MobileStackScreenHeader
            title="Students"
            subtitle={tenant?.academyName ?? 'My Academy'}
            backHref="/admin/dashboard/batch"
          />

          <div className="mb-3 flex justify-end">
            <ExternalStudentRegistrationLink />
          </div>

          <div className="mb-3 space-y-3">
            <MobileFormFieldCard label="Search">
              <MobilePillControl>
                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute start-3 size-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 border-0 bg-transparent ps-9 shadow-none focus-visible:ring-0"
                    placeholder="Name or registration no."
                  />
                </div>
              </MobilePillControl>
            </MobileFormFieldCard>
            <MobileFormFieldCard label="Status">
              <MobilePillControl>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 border-0 bg-transparent shadow-none focus:ring-0">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </MobilePillControl>
            </MobileFormFieldCard>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.data ?? []).map((student) => (
                <MobileEntityRow
                  key={student.id}
                  id={student.id}
                  firstName={student.firstName}
                  lastName={student.lastName}
                  subline={`Reg. ${student.registrationNo} · ${student.status}`}
                  onRowClick={() =>
                    router.push(`/admin/gymnast-management/students/${student.id}/view`)
                  }
                  trailing={<MobileChevronTrail />}
                />
              ))}
              {(data?.data ?? []).length === 0 && (
                <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  No students match your filters
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canPrev}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))
              }
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {totalPages > 0
                ? `Page ${pagination.pageIndex + 1} / ${totalPages}`
                : `Page ${pagination.pageIndex + 1}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={!canNext}
              onClick={() =>
                setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))
              }
            >
              Next
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <MobilePrimaryAction type="button" onClick={handleAddStudent}>
              <Plus className="mr-2 size-4" />
              Add student
            </MobilePrimaryAction>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-2xl font-semibold"
              onClick={handleExport}
            >
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
          </div>
        </MobilePageCanvas>

        <StudentDeleteDialog
          open={deleteDialogOpen}
          closeDialog={() => {
            setDeleteDialogOpen(false);
            setDeleteStudent(null);
            queryClient.invalidateQueries({ queryKey: ['admin-students'] });
          }}
          student={deleteStudent}
        />

        <SendEmailDialog
          open={sendEmailDialogOpen}
          closeDialog={() => {
            setSendEmailDialogOpen(false);
            setRowSelection({});
          }}
          selectedStudents={selectedStudents}
          onSuccess={() => setRowSelection({})}
        />

        <BulkEmailDialog
          open={bulkEmailDialogOpen}
          closeDialog={() => setBulkEmailDialogOpen(false)}
          invalidateKey={['admin-students']}
        />
      </>
    );
  }

  return (
    <>
      <DataGrid
        table={table}
        recordCount={data?.pagination.total || 0}
        isLoading={isLoading}
        tableLayout={{ columnsResizable: true, columnsPinnable: true, columnsMovable: true, columnsVisibility: true }}
        tableClassNames={{ edgeCell: 'px-5' }}
      >
        <Card>
          <DataGridToolbar />
          {hasSelection && (
            <div className="flex items-center gap-2 px-5 py-2 border-b bg-muted/50">
              <span className="text-sm text-muted-foreground mr-2">
                {selectedStudentIds.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendEmailDialogOpen(true)}
                disabled={sendLoginDetailsMutation.isPending}
              >
                <Mail className="mr-2 h-4 w-4" />
                Send email to selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendLoginDetailsMutation.mutate()}
                disabled={sendLoginDetailsMutation.isPending}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Send login details to selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRowSelection({})}
              >
                Clear selection
              </Button>
            </div>
          )}
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

      <StudentDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeleteStudent(null);
          queryClient.invalidateQueries({ queryKey: ['admin-students'] });
        }}
        student={deleteStudent}
      />

      <SendEmailDialog
        open={sendEmailDialogOpen}
        closeDialog={() => {
          setSendEmailDialogOpen(false);
          setRowSelection({});
        }}
        selectedStudents={selectedStudents}
        onSuccess={() => setRowSelection({})}
      />

      <BulkEmailDialog
        open={bulkEmailDialogOpen}
        closeDialog={() => setBulkEmailDialogOpen(false)}
        invalidateKey={['admin-students']}
      />
    </>
  );
};

export default StudentsList;


