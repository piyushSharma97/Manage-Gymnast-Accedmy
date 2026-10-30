'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoaderCircleIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PaymentSchema, PaymentSchemaType } from '../forms/payment-schema';
import { useUserSession } from '@/customHooks/userSession';
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
};

type Invoice = {
  id: string;
  studentId: string;
  locationId: number;
  courseId: number | null;
  amount: number | string | null;
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
  location: {
    id: number;
    centerName: string;
  };
};

export interface PaymentEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  payment: Payment | null;
  invoiceId?: string | null;
}

const PaymentEditDialog = ({
  open,
  closeDialog,
  payment,
  invoiceId: propInvoiceId,
}: PaymentEditDialogProps) => {
  const queryClient = useQueryClient();
  const {user}=useUserSession()
const userLocationId = Number(user?.locationId)

  const [locationId] = useState<number | null>(userLocationId);

  // Form setup
  const form = useForm<PaymentSchemaType>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
      invoiceId: null,
      studentId: '',
      locationId: 0,
      courseId: 0,
      paymentMode: null,
      orderid: null,
      txnid: null,
      amount: 0,
      amountPaid: 0,
      discount: 0,
      siblingDiscount: 0,
      method: null,
      reference: null,
      remarks: null,
      receivedAt: new Date().toISOString().split('T')[0],
    },
  });

  // Fetch invoice data if invoiceId is provided
  const { data: invoiceData } = useQuery({
    queryKey: ['invoice', propInvoiceId],
    queryFn: async () => {
      if (!propInvoiceId) return null;
      const response = await apiFetch(`/api/manager/fees/invoice/${propInvoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json() as Promise<Invoice>;
    },
    enabled: open && !!propInvoiceId && !payment,
  });



  // Fetch students for dropdown (filtered by location)
  const { data: students } = useQuery({
    queryKey: ['students-select', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const response = await apiFetch(`/api/manager/students/select?locationId=${locationId}&status=ACTIVE`);
      if (!response.ok) throw new Error('Failed to fetch students');
      return response.json();
    },
    enabled: open && !!locationId,
  });

  // Fetch courses for dropdown
  const { data: courses } = useQuery({
    queryKey: ['courses-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/course/select');
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    },
    enabled: open,
  });

  // Update form when invoice data is fetched
  useEffect(() => {
    if (open && invoiceData && !payment) {
      form.reset({
        invoiceId: invoiceData.id,
        studentId: invoiceData.studentId,
        locationId: invoiceData.locationId,
        courseId: invoiceData.courseId || 0,
        paymentMode: null,
        orderid: null,
        txnid: null,
        amount: invoiceData.amount ? (typeof invoiceData.amount === 'string' ? parseFloat(invoiceData.amount) : invoiceData.amount) : 0,
        amountPaid: invoiceData.amount ? (typeof invoiceData.amount === 'string' ? parseFloat(invoiceData.amount) : invoiceData.amount) : 0,
        discount: 0,
        siblingDiscount: 0,
        method: null,
        reference: null,
        remarks: null,
        receivedAt: new Date().toISOString().split('T')[0],
      });
    }
  }, [invoiceData, open, payment, form]);

  // Update form when payment changes
  useEffect(() => {
    if (open && payment) {
      form.reset({
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
        locationId: payment.locationId,
        courseId: payment.courseId,
        paymentMode: payment.paymentMode,
        orderid: payment.orderid,
        txnid: payment.txnid,
        amount: typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount,
        amountPaid: typeof payment.amountPaid === 'string' ? parseFloat(payment.amountPaid) : payment.amountPaid,
        discount: typeof payment.discount === 'string' ? parseFloat(payment.discount) : payment.discount,
        siblingDiscount: typeof payment.siblingDiscount === 'string' ? parseFloat(payment.siblingDiscount) : payment.siblingDiscount,
        method: payment.method,
        reference: payment.reference,
        remarks: payment.remarks,
        receivedAt: payment.receivedAt ? payment.receivedAt.split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } else if (open && !payment && !propInvoiceId) {
      form.reset({
        invoiceId: null,
        studentId: '',
        locationId: userLocationId,
        courseId: 0,
        paymentMode: null,
        orderid: null,
        txnid: null,
        amount: 0,
        amountPaid: 0,
        discount: 0,
        siblingDiscount: 0,
        method: null,
        reference: null,
        remarks: null,
        receivedAt: new Date().toISOString().split('T')[0],
      });
    }
  }, [form, open, payment, propInvoiceId, userLocationId]);

  // Reset student when location changes
  useEffect(() => {
    if (open && !locationId) {
      form.setValue('studentId', '');
    }
  }, [locationId, open, form]);

  // Mutation for creating/updating payment
  const mutation = useMutation({
    mutationFn: async (values: PaymentSchemaType) => {
      values.locationId = userLocationId
      const isEdit = !!payment?.id;
      const url = isEdit
        ? `/api/manager/fees/payments/${payment.id}`
        : '/api/manager/fees/payments';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...values,
        studentId: values.studentId,
        invoiceId: values.invoiceId || propInvoiceId || null,
        amount: typeof values.amount === 'string' ? parseFloat(values.amount) : values.amount,
        amountPaid: typeof values.amountPaid === 'string' ? parseFloat(values.amountPaid) : values.amountPaid,
        discount: typeof values.discount === 'string' ? parseFloat(values.discount) : values.discount,
        siblingDiscount: typeof values.siblingDiscount === 'string' ? parseFloat(values.siblingDiscount) : values.siblingDiscount,
        receivedAt: values.receivedAt ? new Date(values.receivedAt).toISOString() : new Date().toISOString(),
      };

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const isEdit = !!payment?.id;
      const message = isEdit
        ? 'Payment updated successfully'
        : 'Payment created successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      closeDialog();
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

  // Derive the loading state from the mutation status
  const isLoading = mutation.status === 'pending';

  // Handle form submission
  const handleSubmit = (values: PaymentSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payment ? 'Edit Payment' : 'Add New Payment'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => handleSubmit(data as PaymentSchemaType))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Invoice ID (read-only if from invoice) */}
              {propInvoiceId && (
                <FormItem>
                  <FormLabel>Invoice ID</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      value={propInvoiceId}
                      readOnly
                      className="bg-muted"
                    />
                  </FormControl>
                  <FormDescription>
                    Payment is linked to this invoice
                  </FormDescription>
                </FormItem>
              )}
           
              {/* Student Select */}
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!locationId || !!propInvoiceId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={locationId ? "Select student" : "Select location first"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students?.map((student: any) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.firstName} {student.lastName || ''} ({student.registrationNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Course Select */}
              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                      disabled={!!propInvoiceId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses?.map((course: any) => (
                          <SelectItem key={course.id} value={course.id.toString()}>
                            {course.courseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Mode */}
              <FormField
                control={form.control}
                name="paymentMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Mode</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Net Banking">Net Banking</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Order ID */}
              <FormField
                control={form.control}
                name="orderid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter order ID"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Transaction ID */}
              <FormField
                control={form.control}
                name="txnid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction ID</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter transaction ID"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                            }
                          }
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount Paid */}
              <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount paid"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                            }
                          }
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Discount */}
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter discount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                            }
                          }
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Sibling Discount */}
              <FormField
                control={form.control}
                name="siblingDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sibling Discount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter sibling discount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(0);
                          } else {
                            const numValue = parseFloat(value);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                            }
                          }
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Method */}
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter payment method"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reference */}
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter reference"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Received At */}
              <FormField
                control={form.control}
                name="receivedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received At</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Remarks */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter remarks"
                      {...field}
                      value={field.value || ''}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                {payment ? 'Update Payment' : 'Create Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentEditDialog;

