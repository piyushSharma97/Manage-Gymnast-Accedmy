'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Printer } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PaymentCollectSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().min(0, 'Amount must be 0 or greater'),
  registration: z.number().min(0, 'Registration must be 0 or greater').default(0),
  discount: z.number().min(0, 'Discount must be 0 or greater').default(0),
  siblingDiscount: z.number().min(0, 'Sibling discount must be 0 or greater').default(0),
  paymentMode: z.enum(['Cash', 'UPI', 'Bank']),
  txnid: z.string().optional().nullable(),
  amountPaid: z.number().min(0, 'Amount paid must be 0 or greater'),
});

type PaymentCollectSchemaType = z.input<typeof PaymentCollectSchema>;

type Invoice = {
  id: string;
  invoiceno: string;
  studentId: string;
  locationId: number;
  courseId: number | null;
  amount: number | string | null;
  registration: number | string | null;
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

interface PaymentCollectFormProps {
  invoiceId: string | null;
}

const parseNumericValue = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

type PaymentSuccess = {
  id: string;
  amountPaid: number;
  paymentMode: string;
  orderid: string | null;
  receivedAt: string;
  student: { firstName: string; lastName: string | null; registrationNo: string };
  invoiceId: string | null;
  tenant: { academyName: string };
  location?: { centerName: string };
  course?: { courseName: string } | null;
};

const PaymentCollectForm = ({ invoiceId }: PaymentCollectFormProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccess | null>(null);

  // Fetch invoice details
  const { data: invoice, isLoading: isLoadingInvoice } = useQuery<Invoice>({
    queryKey: ['invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const response = await apiFetch(`/api/fees/invoice/${invoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    },
    enabled: !!invoiceId,
  });

  // Form setup
  const form = useForm<PaymentCollectSchemaType>({
    resolver: zodResolver(PaymentCollectSchema),
    defaultValues: {
      invoiceId: invoiceId || '',
      amount: 0,
      registration: 0,
      discount: 0,
      siblingDiscount: 0,
      paymentMode: 'Cash',
      txnid: null,
      amountPaid: 0,
    },
  });

  // Update form when invoice is loaded
  useEffect(() => {
    if (invoice) {
      const amount = parseNumericValue(invoice.amount);
      const registration = parseNumericValue(invoice.registration);
      
      form.reset({
        invoiceId: invoice.id,
        amount,
        registration,
        discount: 0,
        siblingDiscount: 0,
        paymentMode: 'Cash',
        txnid: null,
        amountPaid: amount + registration,
      });
    }
  }, [invoice, form]);

  // Calculate amount paid when amount, discount, or siblingDiscount changes
  const amount = Number(form.watch('amount') ?? 0);
  const registrationAmount = Number(form.watch('registration') ?? 0);
  const discount = Number(form.watch('discount') ?? 0);
  const siblingDiscount = Number(form.watch('siblingDiscount') ?? 0);

  useEffect(() => {
    const calculatedAmountPaid = Math.max(0, amount + registrationAmount - discount - siblingDiscount);
    form.setValue('amountPaid', calculatedAmountPaid);
  }, [amount, registrationAmount, discount, siblingDiscount, form]);

  // Mutation for creating payment
  const mutation = useMutation({
    mutationFn: async (values: PaymentCollectSchemaType) => {
      if (!invoice) throw new Error('Invoice not found');

      // Generate order number from invoice number (replace INV with O)
      const orderid = invoice.invoiceno.replace('INV', 'O');

      const payload = {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        locationId: invoice.locationId,
        courseId: invoice.courseId || 0,
        amount: Number(values.amount ?? 0),
        registration: Number(values.registration ?? 0),
        amountPaid: Number(values.amountPaid ?? 0),
        discount: Number(values.discount ?? 0),
        siblingDiscount: Number(values.siblingDiscount ?? 0),
        paymentMode: values.paymentMode ?? 'Cash',
        orderid,
        txnid: values.txnid || null,
        method: values.paymentMode ?? 'Cash',
        reference: values.txnid || null,
        receivedAt: new Date().toISOString(),
      };

      const response = await apiFetch('/api/fees/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (data: PaymentSuccess) => {
      setPaymentSuccess(data);
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>Payment collected successfully. Receipt sent to parent email.</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
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

  const isLoading = mutation.status === 'pending';

  if (isLoadingInvoice) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!invoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invoice Not Found</CardTitle>
          <CardDescription>Please select a valid invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/admin/fees/invoice')}>
            Back to Invoices
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invoiceRegistration = parseNumericValue(invoice.registration);

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleDone = () => {
    router.push('/admin/fees/payments');
  };

  // Receipt view after successful payment
  if (paymentSuccess) {
    const studentName = [paymentSuccess.student.firstName, paymentSuccess.student.lastName]
      .filter(Boolean)
      .join(' ') || paymentSuccess.student.registrationNo;
    const receivedDate = new Date(paymentSuccess.receivedAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const formatCurrency = (n: number) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return (
      <>
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <Card id="receipt-print" className="max-w-2xl">
          <CardHeader>
            <CardTitle>Payment Receipt</CardTitle>
            <CardDescription>Payment collected successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                <div><span className="text-muted-foreground">Student</span><br /><span className="font-semibold">{studentName}</span></div>
                <div><span className="text-muted-foreground">Amount Paid</span><br /><span className="font-semibold">{formatCurrency(paymentSuccess.amountPaid)}</span></div>
                <div><span className="text-muted-foreground">Payment Mode</span><br /><span>{paymentSuccess.paymentMode}</span></div>
                {paymentSuccess.orderid && <div><span className="text-muted-foreground">Order ID</span><br /><span>{paymentSuccess.orderid}</span></div>}
                <div><span className="text-muted-foreground">Date & Time</span><br /><span>{receivedDate}</span></div>
                <div><span className="text-muted-foreground">Academy</span><br /><span>{paymentSuccess.tenant.academyName}</span></div>
                {paymentSuccess.location && <div><span className="text-muted-foreground">Location</span><br /><span>{paymentSuccess.location.centerName}</span></div>}
                {paymentSuccess.course?.courseName && <div><span className="text-muted-foreground">Course</span><br /><span>{paymentSuccess.course.courseName}</span></div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 no-print">
              <Button variant="outline" onClick={handlePrintReceipt}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </Button>
              <Button onClick={handleDone}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>Collect Payment</CardTitle>
        <CardDescription>Enter payment details for the invoice</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-6">
            {/* Invoice Details Display */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Invoice Number</Label>
                <p className="text-lg font-semibold">{invoice.invoiceno}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Student Name</Label>
                <p className="text-lg font-semibold">
                  {invoice.student.firstName} {invoice.student.lastName || ''}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Course Name</Label>
                <p className="text-lg font-semibold">{invoice.course?.courseName || '-'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Registration Amount</Label>
                <p className="text-lg font-semibold">{invoiceRegistration.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField<PaymentCollectSchemaType>
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
                        value={field.value ?? 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<PaymentCollectSchemaType>
                  control={form.control}
                  name="registration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter registration amount"
                        value={field.value ?? 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            field.onChange(Number.isNaN(value) ? 0 : value);
                          }}
                        />
                      </FormControl>
                      <FormDescription>Registration fee associated with this invoice</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<PaymentCollectSchemaType>
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
                        value={field.value ?? 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<PaymentCollectSchemaType>
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
                        value={field.value ?? 0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField<PaymentCollectSchemaType>
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount paid"
                        value={field.value ?? 0}
                          readOnly
                          className="bg-muted"
                        />
                      </FormControl>
                      <FormDescription>
                        Calculated as: Amount + Registration - Discount - Sibling Discount
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<PaymentCollectSchemaType>
                  control={form.control}
                  name="paymentMode"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Payment Mode *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={typeof field.value === 'string' ? field.value : 'Cash'}
                          className="flex flex-row flex-wrap gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Cash" id="cash" />
                            <Label htmlFor="cash">Cash</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="UPI" id="upi" />
                            <Label htmlFor="upi">UPI</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Bank" id="bank" />
                            <Label htmlFor="bank">Bank</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField<PaymentCollectSchemaType>
                  control={form.control}
                  name="txnid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter transaction ID"
                        value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        Required for UPI and Bank payments
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                Collect Payment
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default PaymentCollectForm;

