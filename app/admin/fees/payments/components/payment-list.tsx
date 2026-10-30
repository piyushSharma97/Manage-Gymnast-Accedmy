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
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
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

// Local dialogs
import PaymentEditDialog from './payment-edit-dialog';
import PaymentDeleteDialog from './payment-delete-dialog';

type Payment = {
  id: string;
  studentId: string;
  tenantId: number;
  locationId: number;
  courseId: number;
  invoiceId: string | null;
  paymentMode: string | null;
  orderid: string | null;
  txnid: string | null;
  amount: number | string;
  amountPaid: number | string;
  discount: number | string;
  siblingDiscount: number | string;
  method: string | null;
  reference: string | null;
  remarks: string | null;
  receivedAt: string;
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
  };
  location: {
    id: number;
    centerName: string;
  };
  tenant: {
    id: number;
    academyName: string;
  };
};

interface PaymentListProps {
  invoiceId?: string | null;
}

const PaymentList = ({ invoiceId }: PaymentListProps) => {
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
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);

  // Query state management
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch payments from the server API
  const fetchPayments = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<Payment>> => {
    const sortField = sorting?.[0]?.id || 'createdAt';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(invoiceId ? { invoiceId } : {}),
    });

    const response = await apiFetch(
      `/api/fees/payments?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(
        'Oops! Something didn\'t go as planned. Please try again in a moment',
      );
    }

    return response.json();
  };

  // Payments query
  const { data, isLoading } = useQuery({
    queryKey: [
      'admin-payments',
      pagination,
      sorting,
      searchQuery,
      invoiceId,
    ],
    queryFn: () =>
      fetchPayments({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        filters: [],
        searchQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 60 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  // Table columns definition
  const columns: ColumnDef<Payment>[] = useMemo(
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
          const payment = row.original;
          return (
            <div className="flex flex-col">
              <span className="font-medium">
                {payment.student.firstName} {payment.student.lastName || ''}
              </span>
              <span className="text-sm text-muted-foreground">
                {payment.student.registrationNo}
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
          const payment = row.original;
          return <span>{payment.location.centerName}</span>;
        },
      },
      {
        accessorKey: 'course.courseName',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Course" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          return <span>{payment.course.courseName}</span>;
        },
      },
      {
        accessorKey: 'amountPaid',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Amount Paid" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          const amount = typeof payment.amountPaid === 'number'
            ? payment.amountPaid
            : payment.amountPaid
              ? parseFloat(payment.amountPaid)
              : 0;
          return <span>{amount.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'paymentMode',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Payment Mode" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          return <span>{payment.paymentMode || '-'}</span>;
        },
      },
      {
        accessorKey: 'orderid',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Order ID" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          return <span>{payment.orderid || '-'}</span>;
        },
      },
      {
        accessorKey: 'txnid',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Transaction ID" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          return <span>{payment.txnid || '-'}</span>;
        },
      },
      {
        accessorKey: 'receivedAt',
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Received At" />
        ),
        cell: ({ row }) => {
          const payment = row.original;
          return (
            <span>
              {payment.receivedAt
                ? new Date(payment.receivedAt).toLocaleDateString()
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
          const payment = row.original;
          return (
            <span>
              {new Date(payment.createdAt).toLocaleDateString()}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const payment = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditPayment(payment);
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
                  setDeletePayment(payment);
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

  // Handle add new payment
  const handleAddPayment = () => {
    setEditPayment(null);
    setEditDialogOpen(true);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
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
                placeholder="Search payments..."
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
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={handleAddPayment}>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment
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
      <PaymentEditDialog
        open={editDialogOpen}
        closeDialog={() => {
          setEditDialogOpen(false);
          setEditPayment(null);
        }}
        payment={editPayment}
        invoiceId={invoiceId}
      />

      {/* Delete Dialog */}
      <PaymentDeleteDialog
        open={deleteDialogOpen}
        closeDialog={() => {
          setDeleteDialogOpen(false);
          setDeletePayment(null);
        }}
        payment={deletePayment}
      />
    </>
  );
};

export default PaymentList;

