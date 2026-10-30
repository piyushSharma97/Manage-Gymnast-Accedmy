'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { InvoiceSchema, InvoiceSchemaType } from '../forms/invoice-schema';

/** Invoice shape accepted by the edit dialog (siblingDiscount, discount, registration optional for list/API data). */
export type InvoiceForEdit = {
  id: string;
  studentId: string;
  locationId: number;
  courseId: number | null;
  batchId: number | null;
  amount: number | string | null;
  siblingDiscount?: number | string | null;
  discount?: number | string | null;
  registration?: number | string | null;
  dueDate: string | null;
  status: 'Pending' | 'Paid' | 'Overdue' | 'PartiallyPaid';
  issuedAt: string;
  paidAt: string | null;
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

export interface InvoiceEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  invoice: InvoiceForEdit | null;
}

const InvoiceEditDialog = ({
  open,
  closeDialog,
  invoice,
}: InvoiceEditDialogProps) => {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [courseName, setCourseName] = useState<string>('');

  const parseDecimalValue = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  // Helper function to get default due date (5th of next month from billing date)
  const getDefaultDueDate = (billingDate: string) => {
    if (!billingDate) return '';
    const date = new Date(billingDate);
    const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 5);
    return nextMonth.toISOString().split('T')[0];
  };

  // Form setup
  const form = useForm<InvoiceSchemaType>({
    resolver: zodResolver(InvoiceSchema),
    defaultValues: {
      studentId: '',
      locationId: 0,
      courseId: null,
      batchId: null,
      amount: null,
      siblingDiscount: 0,
      discount: 0,
      registration: 0,
      billingMonth: new Date().toISOString().split('T')[0],
      dueDate: '',
      status: 'Pending',
      paidAt: null,
    },
  });

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/location/select');
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
    enabled: open,
  });

  // Fetch students for dropdown (filtered by location and with batches)
  const { data: students } = useQuery({
    queryKey: ['students-select', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const response = await apiFetch(`/api/student/select?locationId=${locationId}&status=ACTIVE&withBatches=true`);
      if (!response.ok) throw new Error('Failed to fetch students');
      return response.json();
    },
    enabled: open && !!locationId,
  });

  // Fetch selected student details to get courseId
  const selectedStudentId = form.watch('studentId');
  
  // Fetch student details directly to get courseId
  const { data: selectedStudentData } = useQuery({
    queryKey: ['student-details', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const response = await apiFetch(`/api/student/${selectedStudentId}`);
      if (!response.ok) throw new Error('Failed to fetch student');
      return response.json();
    },
    enabled: open && !!selectedStudentId,
  });

  // Fetch course details for selected student
  const { data: courseData } = useQuery({
    queryKey: ['course', selectedStudentData?.courseId],
    queryFn: async () => {
      if (!selectedStudentData?.courseId) return null;
      const response = await apiFetch(`/api/course/${selectedStudentData.courseId}`);
      if (!response.ok) throw new Error('Failed to fetch course');
      return response.json();
    },
    enabled: open && !!selectedStudentData?.courseId,
  });

  // Fetch latest batch for selected student to get amount
  const { data: latestBatch } = useQuery({
    queryKey: ['batch-latest', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const response = await apiFetch(`/api/batch?studentId=${selectedStudentId}&limit=1&sort=createdAt&dir=desc`);
      if (!response.ok) throw new Error('Failed to fetch batch');
      const data = await response.json();
      return data.data && data.data.length > 0 ? data.data[0] : null;
    },
    enabled: open && !!selectedStudentId,
  });

  // Update form when invoice changes
  useEffect(() => {
    if (open && invoice) {
      setLocationId(invoice.locationId);
      const billingMonth = (invoice as any).billingMonth 
        ? (invoice as any).billingMonth.split('T')[0] 
        : new Date().toISOString().split('T')[0];
      form.reset({
        studentId: invoice.studentId,
        locationId: invoice.locationId,
        courseId: invoice.courseId,
        batchId: invoice.batchId,
        amount: parseDecimalValue(invoice.amount),
        siblingDiscount: parseDecimalValue(invoice.siblingDiscount) ?? 0,
        discount: parseDecimalValue(invoice.discount) ?? 0,
        registration: parseDecimalValue(invoice.registration) ?? 0,
        billingMonth,
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : getDefaultDueDate(billingMonth),
        status: 'Pending',
        paidAt: null,
      });
      if (invoice.course) {
        setCourseName(invoice.course.courseName);
      }
    } else if (open && !invoice) {
      setLocationId(null);
      setCourseName('');
      const today = new Date().toISOString().split('T')[0];
      form.reset({
        studentId: '',
        locationId: 0,
        courseId: null,
        batchId: null,
        amount: null,
        siblingDiscount: 0,
        discount: 0,
        registration: 0,
        billingMonth: today,
        dueDate: getDefaultDueDate(today),
        status: 'Pending',
        paidAt: null,
      });
    }
  }, [form, open, invoice]);

  // Reset course and amount when student changes
  useEffect(() => {
    if (!selectedStudentId) {
      // Clear fields when student is cleared
      setCourseName('');
      form.setValue('courseId', null);
      form.setValue('batchId', null);
      form.setValue('amount', null);
    } else {
      // Clear batch and amount when student changes (course will be set by courseData effect)
      form.setValue('batchId', null);
      form.setValue('amount', null);
    }
  }, [selectedStudentId, form]);

  // Update course name from student's courseId
  useEffect(() => {
    if (courseData && courseData.courseName) {
      setCourseName(courseData.courseName);
      form.setValue('courseId', courseData.id);
    } else if (selectedStudentId) {
      // If student is selected but no course data yet, clear course name
      // This handles both loading state and when student has no course
      if (selectedStudentData && !selectedStudentData?.courseId) {
        // Student has no course
        setCourseName('');
        form.setValue('courseId', null);
      } else if (!selectedStudentData) {
        // Still loading student data, clear course name
        setCourseName('');
        form.setValue('courseId', null);
      }
    }
  }, [courseData, selectedStudentId, selectedStudentData, form]);

  // Update amount from latest batch
  useEffect(() => {
    if (latestBatch && latestBatch.amount !== null && latestBatch.amount !== undefined) {
      form.setValue('batchId', latestBatch.id);
      form.setValue('amount', typeof latestBatch.amount === 'string' ? parseFloat(latestBatch.amount) : latestBatch.amount);
    } else if (selectedStudentId && latestBatch === null) {
      // Reset if no batch found (query completed but returned null)
      form.setValue('batchId', null);
      form.setValue('amount', null);
    }
  }, [latestBatch, selectedStudentId, form]);

  // Update due date when billing month changes
  const billingMonth = form.watch('billingMonth');
  useEffect(() => {
    if (billingMonth) {
      const calculatedDueDate = getDefaultDueDate(billingMonth);
      form.setValue('dueDate', calculatedDueDate);
    }
  }, [billingMonth, form]);

  // Reset student and related fields when location changes
  useEffect(() => {
    if (open && !locationId) {
      form.setValue('studentId', '');
      setCourseName('');
      form.setValue('courseId', null);
      form.setValue('batchId', null);
      form.setValue('amount', null);
    }
  }, [locationId, open, form]);

  // Mutation for creating/updating invoice
  const mutation = useMutation({
    mutationFn: async (values: InvoiceSchemaType) => {
      const isEdit = !!invoice?.id;
      const url = isEdit
        ? `/api/fees/invoice/${invoice.id}`
        : '/api/fees/invoice';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...values,
        studentId: values.studentId, // Send as string, API will convert to BigInt
        amount: values.amount !== null && values.amount !== undefined 
          ? (typeof values.amount === 'string' ? parseFloat(values.amount) : values.amount)
          : null,
        siblingDiscount:
          values.siblingDiscount !== null && values.siblingDiscount !== undefined
            ? (typeof values.siblingDiscount === 'string'
                ? parseFloat(values.siblingDiscount)
                : values.siblingDiscount)
            : 0,
        discount:
          values.discount !== null && values.discount !== undefined
            ? (typeof values.discount === 'string'
                ? parseFloat(values.discount)
                : values.discount)
            : 0,
        registration:
          values.registration !== null && values.registration !== undefined
            ? (typeof values.registration === 'string'
                ? parseFloat(values.registration)
                : values.registration)
            : 0,
        billingMonth: values.billingMonth ? new Date(values.billingMonth).toISOString() : new Date().toISOString(),
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
        status: 'Pending', // Always set to Pending
        paidAt: null, // Always null
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
      const isEdit = !!invoice?.id;
      const message = isEdit
        ? 'Invoice updated successfully'
        : 'Invoice created successfully';

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
  const handleSubmit = (values: InvoiceSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {invoice ? 'Edit Invoice' : 'Add New Invoice'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location Select - First */}
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const locId = parseInt(value);
                        setLocationId(locId);
                        field.onChange(locId);
                        form.setValue('studentId', '');
                        setCourseName('');
                        form.setValue('courseId', null);
                        form.setValue('batchId', null);
                        form.setValue('amount', null);
                      }}
                      value={locationId ? locationId.toString() : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((location: any) => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.centerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Student Select - Second, filtered by location */}
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!locationId}
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

              {/* Course Name Display (Read-only) */}
              <FormItem>
                <FormLabel>Course</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={courseName}
                    readOnly
                    placeholder="Course will be populated based on student"
                    className="bg-muted"
                  />
                </FormControl>
                <FormDescription>
                  Course is automatically selected from the student's latest batch
                </FormDescription>
              </FormItem>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Original)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(null);
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
                    <FormDescription>Base fee from batch before discounts</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount to be paid - calculated after discounts */}
              <FormItem>
                <FormLabel>Amount to be paid</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    readOnly
                    value={(() => {
                      const amount = form.watch('amount');
                      const siblingDiscount = form.watch('siblingDiscount') ?? 0;
                      const discount = form.watch('discount') ?? 0;
                      const registration = form.watch('registration') ?? 0;
                      const base = amount !== null && amount !== undefined ? (typeof amount === 'number' ? amount : parseFloat(amount)) : 0;
                      const sib = typeof siblingDiscount === 'number' ? siblingDiscount : (siblingDiscount ? parseFloat(String(siblingDiscount)) : 0);
                      const disc = typeof discount === 'number' ? discount : (discount ? parseFloat(String(discount)) : 0);
                      const reg = typeof registration === 'number' ? registration : (registration ? parseFloat(String(registration)) : 0);
                      const total = Math.max(0, base - sib - disc + reg);
                      return Number.isNaN(total) ? '0.00' : total.toFixed(2);
                    })()}
                    className="bg-muted font-medium"
                  />
                </FormControl>
                <FormDescription>
                  Final amount after discounts and registration (Original − Sibling Discount − Discount + Registration)
                </FormDescription>
              </FormItem>

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
                        min="0"
                        placeholder="Enter sibling discount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(null);
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
                    <FormDescription>Enter numeric values. Decimals are allowed.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        min="0"
                        placeholder="Enter discount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(null);
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
                    <FormDescription>Enter numeric values. Decimals are allowed.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter registration amount"
                        value={field.value === null || field.value === undefined ? '' : field.value}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null || value === undefined) {
                            field.onChange(null);
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
                    <FormDescription>Enter numeric values. Decimals are allowed.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      The billing date for this invoice
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>
                      Defaults to 5th of next month from billing date
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                {invoice ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceEditDialog;

