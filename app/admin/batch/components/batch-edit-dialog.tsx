'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { LoaderCircleIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BatchSchema, BatchSchemaType } from '../forms/batch-schema';

type Batch = {
  id: number;
  studentId: string;
  programId: number;
  courseId: number;
  paymentCycle: string | null;
  amount: number | null;
  monday: string | null;
  tuesday: string | null;
  wednesday: string | null;
  thursday: string | null;
  friday: string | null;
  saturday: string | null;
  sunday: string | null;
  coachId: number | null;
  isActive: boolean;
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
};

export interface BatchEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  batch: Batch | null;
  createBatchForStudent?: { studentId: string; locationId: number } | null;
}

// Generate time options from 7am to 7pm (hourly)
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 7; hour <= 19; hour++) {
    const time12h = hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`;
    times.push({ value: time12h, label: time12h });
  }
  return times;
};

const timeOptions = generateTimeOptions();

const daysOfWeek = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const BatchEditDialog = ({
  open,
  closeDialog,
  batch,
  createBatchForStudent,
}: BatchEditDialogProps) => {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState<number | null>(null);

  // Form setup
  const form = useForm<BatchSchemaType>({
    resolver: zodResolver(BatchSchema),
    defaultValues: {
      studentId: '',
      programId: 0,
      paymentCycle: 'perClass',
      courseId: 0,
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
      coachId: null,
      isActive: true,
    },
  });

  // Fetch locations for dropdown
  const { data: locations } = useQuery({
    queryKey: ['locations-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.location.select);
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
    enabled: open,
  });

  // Fetch students for dropdown (filtered by location)
  const { data: students } = useQuery({
    queryKey: ['students-select', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const response = await apiFetch(withParams(API_PATHS.student.select, `locationId=${locationId}&status=ACTIVE`));
      if (!response.ok) throw new Error('Failed to fetch students');
      return response.json();
    },
    enabled: open && !!locationId,
  });

  // Fetch programs for dropdown
  const { data: programs } = useQuery({
    queryKey: ['programs-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.program.select);
      if (!response.ok) throw new Error('Failed to fetch programs');
      return response.json();
    },
    enabled: open,
  });

  // Fetch courses for dropdown (filtered by program and payment cycle)
  const { data: courses } = useQuery({
    queryKey: ['courses-select', form.watch('programId'), form.watch('paymentCycle')],
    queryFn: async () => {
      const programId = form.watch('programId');
      const paymentCycle = form.watch('paymentCycle');
      if (!programId || !paymentCycle) return [];
      const response = await apiFetch(withParams(API_PATHS.course.select, `programId=${programId}&paymentCycle=${paymentCycle}`));
      if (!response.ok) throw new Error('Failed to fetch courses');
      return response.json();
    },
    enabled: open && !!form.watch('programId') && !!form.watch('paymentCycle'),
  });

  // Fetch coaches for dropdown
  const { data: coaches } = useQuery({
    queryKey: ['coaches-select'],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.employee.select, 'role=Coach'));
      if (!response.ok) throw new Error('Failed to fetch coaches');
      return response.json();
    },
    enabled: open,
  });

  // Update form when batch changes
  useEffect(() => {
    if (open && batch) {
      // For editing, we need to fetch the student's location first
      // For now, we'll set locationId to null and let user select
      form.reset({
        studentId: batch.studentId,
        programId: batch.programId,
        paymentCycle: (batch.paymentCycle as 'perClass' | 'monthly' | 'quarterly' | 'halfYearly') || 'perClass',
        courseId: batch.courseId,
        monday: batch.monday || null,
        tuesday: batch.tuesday || null,
        wednesday: batch.wednesday || null,
        thursday: batch.thursday || null,
        friday: batch.friday || null,
        saturday: batch.saturday || null,
        sunday: batch.sunday || null,
        coachId: batch.coachId || null,
        isActive: batch.isActive,
      });
      setLocationId(null);
    } else if (open && createBatchForStudent) {
      // Creating new batch for a specific student
      form.reset({
        studentId: createBatchForStudent.studentId,
        programId: 0,
        paymentCycle: 'perClass',
        courseId: 0,
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
        coachId: null,
        isActive: true,
      });
      setLocationId(createBatchForStudent.locationId);
    } else if (open && !batch) {
      form.reset({
        studentId: '',
        programId: 0,
        paymentCycle: 'perClass',
        courseId: 0,
        monday: null,
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
        saturday: null,
        sunday: null,
        coachId: null,
        isActive: true,
      });
      setLocationId(null);
    }
  }, [form, open, batch, createBatchForStudent]);

  // Reset course when program or payment cycle changes
  useEffect(() => {
    if (open && !batch) {
      form.setValue('courseId', 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('programId'), form.watch('paymentCycle'), open, batch]);

  // Reset student when location changes (only if not creating for specific student)
  useEffect(() => {
    if (open && !batch && !createBatchForStudent) {
      form.setValue('studentId', '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, open, batch, createBatchForStudent]);

  // Mutation for creating/updating batch
  const mutation = useMutation({
    mutationFn: async (values: BatchSchemaType) => {
      const isEdit = !!batch?.id;
      const url = isEdit
        ? API_PATHS.batch.byId(String(batch.id))
        : API_PATHS.batch.list;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const isEdit = !!batch?.id;
      const message = isEdit
        ? 'Batch updated successfully'
        : 'Batch added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-batches'] });
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
  const handleSubmit = (values: BatchSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {batch ? 'Edit Batch' : createBatchForStudent ? 'Add New Batch for Student' : 'Add New Batch'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Location *</label>
                <Select
                  value={locationId ? locationId.toString() : ''}
                  onValueChange={(value) => setLocationId(parseInt(value))}
                  disabled={!!createBatchForStudent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((location: { id: number; centerName: string }) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.centerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Select */}
              <FormField
                control={form.control}
                name="studentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                      disabled={!locationId || !!createBatchForStudent}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {students?.map((student: { id: number; firstName: string; lastName: string; registrationNo: string }) => (
                          <SelectItem key={student.id} value={student.id.toString()}>
                            {student.firstName} {student.lastName} ({student.registrationNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Program Select */}
              <FormField
                control={form.control}
                name="programId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select program" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {programs?.map((program: { id: number; name: string }) => (
                          <SelectItem key={program.id} value={program.id.toString()}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Cycle Select */}
              <FormField
                control={form.control}
                name="paymentCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Cycle *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment cycle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="perClass">Per Class</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="halfYearly">Half Yearly</SelectItem>
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
                      disabled={!form.watch('programId') || !form.watch('paymentCycle')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses?.map((course: { id: number; courseName: string; feeAmount: number | null }) => {
                          const feeDisplay = course.feeAmount !== null && course.feeAmount !== undefined
                            ? `(${course.feeAmount.toFixed(2)})`
                            : '(N/A)';
                          return (
                            <SelectItem key={course.id} value={course.id.toString()}>
                              {course.courseName} {feeDisplay}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Coach Select */}
              <FormField
                control={form.control}
                name="coachId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === 'none' || !value ? null : parseInt(value))
                      }
                      value={field.value ? field.value.toString() : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select coach" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Coach</SelectItem>
                        {coaches?.map((coach: { id: number; firstName: string; lastName: string }) => (
                          <SelectItem key={coach.id} value={coach.id.toString()}>
                            {coach.firstName} {coach.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            {/* Days of Week Time Selection Table */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Class Times by Day *</label>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Day</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daysOfWeek.map((day) => (
                      <TableRow key={day.key}>
                        <TableCell className="font-medium">{day.label}</TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={day.key as keyof BatchSchemaType}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                                  value={field.value ? String(field.value) : 'none'}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select time" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="none">No class</SelectItem>
                                    {timeOptions.map((time) => (
                                      <SelectItem key={time.value} value={time.value}>
                                        {time.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                Select the time for each day when the student will attend classes. At least one day must have a time selected.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                {batch ? 'Update Batch' : 'Add Batch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BatchEditDialog;
