'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
import { Pencil, Trash2, Plus, Search, X, FileText, Info, CreditCard, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { LoaderCircleIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useUserSession } from '@/customHooks/userSession';
// Local dialogs
import InvoiceEditDialog from './invoice-edit-dialog';
import InvoiceDeleteDialog from './invoice-delete-dialog';
import InvoiceGroupDeleteDialog from './invoice-group-delete-dialog';

type Invoice = {
  id: string;
  studentId: string;
  tenantId: number;
  locationId: number;
  billingMonth: string;
  courseId: number | null;
  batchId: number | null;
  amount: number | string | null;
  siblingDiscount: number | string | null;
  discount: number | string | null;
  registration: number | string | null;
  dueDate: string | null;
  status: 'Pending' | 'Paid' | 'Overdue' | 'PartiallyPaid';
  issuedAt: string;
  paidAt: string | null;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string | null;
    registrationNo: string;
  };
  course: {
    id: number;
    courseName: string;
  } | null;
  batch: {
    id: number;
  } | null;
  location: {
    id: number;
    centerName: string;
  };
  tenant: {
    id: number;
    academyName: string;
  };
};

const InvoiceList = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const {user} = useUserSession();
  const userLocationId = Number(user?.locationId);
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
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [deleteInvoiceIds, setDeleteInvoiceIds] = useState<string[]>([]);
  const [sendingEmailInvoiceId, setSendingEmailInvoiceId] = useState<string | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');

  // Fetch invoices from the server API
  const fetchInvoices = async ({
    pageIndex = 0,
    pageSize = 10,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Invoice>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      locationId: String(userLocationId),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(studentFilter !== 'all' ? { studentId: studentFilter } : {}),
      ...(courseFilter !== 'all' ? { courseId: courseFilter } : {}),
      ...(locationFilter !== 'all' ? { locationId: locationFilter } : {}),
    });

    const response = await apiFetch(
      `/api/manager/fees/invoice?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Invoices query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-invoices',
      pagination,
      sorting,
      searchQuery,
      statusFilter,
      studentFilter,
      courseFilter,
      locationFilter,
    ],
    queryFn: () =>
      fetchInvoices({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [
          ...(statusFilter !== 'all' ? [{ id: 'status', value: statusFilter }] : []),
          ...(studentFilter !== 'all' ? [{ id: 'studentId', value: studentFilter }] : []),
          ...(courseFilter !== 'all' ? [{ id: 'courseId', value: courseFilter }] : []),
          ...(locationFilter !== 'all' ? [{ id: 'locationId', value: locationFilter }] : []),
        ],
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  });

  // Handle row selection
  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => row.original.id);
    setDeleteInvoiceIds(selectedIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  // Table columns definition
  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <DataGridTableRowSelectAll />
        ),
        size: 60,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'student',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Student" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {invoice.student.firstName} {invoice.student.lastName || ''}
              </span>
              <span className="text-sm text-muted-foreground">
                {invoice.student.registrationNo}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'location.centerName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Location" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          return <span>{invoice.location.centerName}</span>;
        },
      },
      {
        accessorKey: 'course.courseName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          return <span>{invoice.course?.courseName || '-'}</span>;
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Amount" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          const amount = typeof invoice.amount === 'number'
            ? invoice.amount
            : invoice.amount
              ? parseFloat(invoice.amount)
              : 0;
          return <span>{amount.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          const statusColors: Record<string, 'success' | 'secondary' | 'destructive' | 'outline'> = {
            Paid: 'success',
            Pending: 'secondary',
            Overdue: 'destructive',
            PartiallyPaid: 'outline',
          };
          return (
            <Badge variant={statusColors[invoice.status] || 'secondary'}>
              {invoice.status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'dueDate',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Due Date" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          return (
            <span>
              {invoice.dueDate
                ? new Date(invoice.dueDate).toLocaleDateString()
                : '-'}
            </span>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => {
          const invoice = row.original;
          return (
            <span>
              {new Date(invoice.createdAt).toLocaleDateString()}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 140,
        minSize: 120,
        enablePinning: true,
        enableResizing: false,
        enableHiding: false,
        cell: ({ row }) => {
          const invoice = row.original;
          const isSending = sendingEmailInvoiceId === invoice.id;
          return (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSending}
                    onClick={async () => {
                      setSendingEmailInvoiceId(invoice.id);
                      try {
                        const res = await apiFetch(`/api/manager/fees/invoice/${invoice.id}/send-email`, {
                          method: 'POST',
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.message || 'Failed to send');
                        toast.success('Invoice email sent successfully');
                        queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to send email');
                      } finally {
                        setSendingEmailInvoiceId(null);
                      }
                    }}
                    title="Send invoice email to parent"
                  >
                    {isSending ? (
                      <LoaderCircleIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 text-blue-600" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send invoice email to parent</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  router.push(`/admin/fees/payments/collect?invoiceId=${invoice.id}`);
                }}
                title="Pay"
              >
                <CreditCard className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditInvoice(invoice);
                  setEditDialogOpen(true);
                }}
                title="Edit"
              ><Pencil className="h-2 w-2" />
              </Button>
            </div>
          );
        },
      },
    ],
    [sendingEmailInvoiceId, queryClient, router]
  );

  // Table instance
  const table = useReactTable({
    data: data?.data || [],
    columns,
    initialState: {
      columnPinning: { right: ['actions'] },
    },
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

  // Handle add new invoice
  const handleAddInvoice = () => {
    setEditInvoice(null);
    setEditDialogOpen(true);
  };

  // Mutation for generating invoices
  const generateInvoicesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/manager/fees/invoice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data) => {
      const message = `Successfully generated ${data.generated} invoice(s)${data.skipped > 0 ? `. ${data.skipped} skipped.` : ''}`;
      
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (error: Error) => {
      const message = error.message;
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    },
  });

  // Handle generate invoices
  const handleGenerateInvoices = () => {
    if (confirm('This will generate invoices for all students who attended classes in the previous month. Do you want to continue?')) {
      generateInvoicesMutation.mutate();
    }
  };


  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
  };

  // Clear filters
  const clearFilters = () => {
    setStatusFilter('all');
    setStudentFilter('all');
    setCourseFilter('all');
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
                placeholder="Search invoices..."
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="PartiallyPaid">Partially Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            {(statusFilter !== 'all' || studentFilter !== 'all' || courseFilter !== 'all' || locationFilter !== 'all') && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
           
            <div className="relative inline-flex items-center">
              <Button
                variant="outline"
                onClick={handleGenerateInvoices}
                disabled={generateInvoicesMutation.isPending}
              >
                {generateInvoicesMutation.isPending ? (
                  <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Generate Invoices
              </Button>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute -right-2 -top-2 rounded-full bg-muted p-1 hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>
                      Generate invoice will generate invoices of those students who have attended classes in previous month
                    </p>
                  </TooltipContent>
                </Tooltip>
                <PopoverContent side="top" className="max-w-xs" onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm">
                    Generate invoice will generate invoices of those students who have attended classes in previous month
                  </p>
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleAddInvoice}>
              <Plus className="mr-2 h-4 w-4" />
              Add Invoice
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
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <DataGridTable />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>

      {/* Edit Dialog */}
      <InvoiceEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditInvoice(null);
        }}
        invoice={editInvoice}
      />


    </>
  );
};

export default InvoiceList;

