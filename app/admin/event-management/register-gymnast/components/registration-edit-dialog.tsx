'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { LoaderCircleIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RegistrationSchema, RegistrationSchemaType } from '../forms/registration-schema';
import type { StudentSelectOption, EventSelectOption, SkillLevelSelectOption } from '@/types/domain';

export type Registration = {
  id: number;
  studentId: string;
  eventId?: number; // Optional for backward compatibility
  eventid?: number; // Actual field name from API
  Fees: number;
  EarlyBirdDisc: number | null;
  SiblingDisc: number | null;
  Total: number;
  Additional: number | null;
  PaymentMode: string | null;
  Comments: string | null;
  Status: number | string | null; // Can be number (from DB) or string (from form)
  depositdate: Date | string | null;
  level: string | null;
  eventtype: string | null;
  timing: string | null;
  txnid: string | null;
  student?: {
    id: string;
    registrationNo: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  };
  event?: {
    id: number;
    name: string;
    event_type: string | null;
    fees: number;
    time?: string | null; // optional so list response (without time) is assignable
    startdate?: Date | string;
    enddate?: Date | string;
  };
};

export interface RegistrationgymnastEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  registration: Registration | null;
  onSuccess?: () => void;
}

const RegistrationgymnastEditDialog = ({
  open,
  closeDialog,
  registration,
  onSuccess,
}: RegistrationgymnastEditDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<Registration['event'] | null>(null);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const form = useForm<RegistrationSchemaType>({
    resolver: zodResolver(RegistrationSchema) as Resolver<RegistrationSchemaType>,
    defaultValues: {
      studentId: '',
      eventId: '',
      Fees: 0,
      EarlyBirdDisc: null,
      SiblingDisc: null,
      Additional: null,
      Total: 0,
      PaymentMode: 'Cash',
      Comments: null,
      Status: 'Paid',
      depositdate: getTodayDateString(),
      level: null,
      eventtype: null,
      timing: null,
      txnid: null,
    },
  });

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ['students-select'],
    queryFn: async () => {
      const response = await apiFetch(withParams(API_PATHS.student.list, 'limit=1000'));
      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      return data.data || [];
    },
    enabled: open,
  });

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ['events-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.eventManagement.events.select);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: open,
  });

  // Fetch levels
  const { data: levels } = useQuery({
    queryKey: ['skill-levels-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/skill-level/select');
      if (!response.ok) throw new Error('Failed to fetch levels');
      return response.json();
    },
    enabled: open,
  });

  // Watch eventId to update fees and event type
  const eventId = form.watch('eventId');
  const studentIdWatched = form.watch('studentId');

  // Check if student is already registered for this event (only when creating new registration)
  const { data: existingRegistrationCheck } = useQuery({
    queryKey: ['registration-exists', studentIdWatched, eventId],
    queryFn: async () => {
      if (!studentIdWatched || !eventId) return { exists: false };
      const params = new URLSearchParams({
        studentId: String(studentIdWatched),
        eventId: String(eventId),
        limit: '1',
      });
      const response = await apiFetch(
        withParams(API_PATHS.eventManagement.registerGymnast.list, params)
      );
      if (!response.ok) return { exists: false };
      const json = await response.json();
      const existing = Array.isArray(json?.data) ? json.data.length > 0 : false;
      return { exists: existing };
    },
    enabled: open && !registration && !!studentIdWatched && !!eventId,
  });

  const alreadyRegistered =
    !registration && existingRegistrationCheck?.exists === true;

  useEffect(() => {
    if (eventId && events) {
      const event = events.find((e: { id: number; fees?: number; time?: string | null }) => e.id.toString() === eventId);
      if (event) {
        setSelectedEvent(event);
        if (!registration) {
          form.setValue('Fees', event.fees || 0);
          form.setValue('timing', event.time ?? null);
          form.setValue('eventtype', null); // Category is independent - user fills manually
        }
      }
    }
  }, [eventId, events, form, registration]);

  // Populate form when editing
  useEffect(() => {
    if (registration) {
      const formatDate = (date: Date | string | null): string => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
      };

      // Convert numeric Status to string
      const getStatusString = (status: number | string | null | undefined): string => {
        if (typeof status === 'string') return status;
        if (typeof status === 'number') {
          const statusMap: Record<number, string> = {
            0: 'Pending',
            1: 'Paid',
            2: 'Partial',
            3: 'Cancelled',
          };
          return statusMap[status] || 'Pending';
        }
        return 'Pending';
      };

      // Get eventId from either eventId or eventid field (API returns eventid)
      const eventIdValue = registration.eventId ?? registration.eventid;
      
      form.reset({
        studentId: registration.studentId.toString(),
        eventId: eventIdValue ? eventIdValue.toString() : '',
        Fees: Number(registration.Fees),
        EarlyBirdDisc: registration.EarlyBirdDisc ? Number(registration.EarlyBirdDisc) : null,
        SiblingDisc: registration.SiblingDisc ? Number(registration.SiblingDisc) : null,
        Additional: registration.Additional ? Number(registration.Additional) : null,
        Total: Number(registration.Total),
        PaymentMode: registration.PaymentMode || '',
        Comments: registration.Comments || null,
        Status: getStatusString(registration.Status),
        depositdate: formatDate(registration.depositdate),
        level: registration.level || null,
        eventtype: registration.eventtype || null,
        timing: registration.timing || null,
        txnid: registration.txnid || null,
      });

      // Set selected event
      if (registration.event) {
        setSelectedEvent(registration.event);
      }
    } else {
      form.reset({
        studentId: '',
        eventId: '',
        Fees: 0,
        EarlyBirdDisc: null,
        SiblingDisc: null,
        Additional: null,
        Total: 0,
        PaymentMode: 'Cash',
        Comments: null,
        Status: 'Paid',
        depositdate: getTodayDateString(),
        level: null,
        eventtype: null,
        timing: null,
        txnid: null,
      });
      setSelectedEvent(null);
    }
  }, [registration, form]);

  // Reset mutation state when dialog opens to prevent stale loading state
  useEffect(() => {
    if (open) {
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clear form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        studentId: '',
        eventId: '',
        Fees: 0,
        EarlyBirdDisc: null,
        SiblingDisc: null,
        Additional: null,
        Total: 0,
        PaymentMode: 'Cash',
        Comments: null,
        Status: 'Paid',
        depositdate: getTodayDateString(),
        level: null,
        eventtype: null,
        timing: null,
        txnid: null,
      });
      setSelectedEvent(null);
    }
  }, [open, form]);

  // Calculate total when fees/discounts change
  const fees = form.watch('Fees') || 0;
  const earlyBirdDisc = form.watch('EarlyBirdDisc') || 0;
  const siblingDisc = form.watch('SiblingDisc') || 0;
  const additional = form.watch('Additional') || 0;
  const calculatedTotal = fees - earlyBirdDisc - siblingDisc + additional;

  useEffect(() => {
    form.setValue('Total', calculatedTotal);
  }, [fees, earlyBirdDisc, siblingDisc, additional, form,calculatedTotal]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: RegistrationSchemaType) => {
      // Create a new object with eventId as number for the API
        const apiData: Omit<RegistrationSchemaType, 'eventId'> & { eventId: number } = {
          ...data,
          eventId: Number(data.eventId),
        };
      const url = registration
        ? API_PATHS.eventManagement.registerGymnast.byId(String(registration.id))
        : API_PATHS.eventManagement.registerGymnast.list;
      const method = registration ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const message = registration
        ? 'Registration updated successfully'
        : 'Gymnast registered successfully';

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

      queryClient.invalidateQueries({ queryKey: ['event-registrations'] });
      onSuccess?.();
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

  const onSubmit = (data: RegistrationSchemaType) => {
    if (alreadyRegistered) {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>This student is already registered for the selected event.</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
      return;
    }
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {registration ? 'Edit Registration' : 'Register Gymnast for Event'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {alreadyRegistered && (
              <Alert variant="mono" icon="destructive">
                <AlertIcon>
                  <RiErrorWarningFill />
                </AlertIcon>
                <AlertTitle>This student is already registered for the selected event. Only one registration per student per event is allowed.</AlertTitle>
              </Alert>
            )}
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Student *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {students?.map((student: StudentSelectOption) => (
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

                <FormField
                  control={form.control}
                  name="eventId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select event" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {events?.map((event: EventSelectOption) => (
                            <SelectItem key={event.id} value={event.id.toString()}>
                              {event.name} {event.event_type ? `(${event.event_type})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eventtype"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Event type" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {levels?.map((level: SkillLevelSelectOption) => (
                            <SelectItem key={level.id} value={level.levelName}>
                              {level.levelName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Financial Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Financial Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="Fees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fees *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          value={field.value || ''}
                        />
                      </FormControl>
                  
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="EarlyBirdDisc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Early Bird Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="SiblingDisc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sibling Discount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="Additional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Charges</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">Total Amount:</span>
                  <span className="text-xl font-bold text-foreground">{calculatedTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Payment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="PaymentMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Mode *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                          <SelectItem value="Online">Online</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="Status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'Pending'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Partial">Partial</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="depositdate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deposit Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="txnid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Transaction ID" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Additional Details Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Additional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timing</FormLabel>
                      <FormControl>
                        <Input placeholder="Event timing" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="Comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional comments"
                        {...field}
                        value={field.value || ''}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || alreadyRegistered}
              >
                {mutation.isPending && (
                  <LoaderCircleIcon className="animate-spin mr-2 h-4 w-4" />
                )}
                {registration ? 'Update Registration' : 'Register Gymnast'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationgymnastEditDialog; 