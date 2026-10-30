'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTenant } from '@/hooks/use-tenant';
import { EXTERNAL_EVENT_TYPE } from '@/lib/event-external';
import { buildExternalEventRegistrationUrl } from '@/lib/external-event-registration-url';
import { EventSchema, EventSchemaType, EventFormType } from '../forms/event-schema';

export type Event = {
  id: number;
  name: string;
  description: string;
  event_type: string | null;
  startdate: Date | string;
  enddate: Date | string;
  fees: number;
  earlybird?: number | null;
  early_date?: Date | string | null;
  regstart_date?: Date | string | null;
  regend?: Date | string | null;
  time?: string | null;
  locationId: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  location?: {
    id: number;
    centerName: string;
  };
};

export interface EventEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  event: Event | null;
}

const EventEditDialog = ({
  open,
  closeDialog,
  event,
}: EventEditDialogProps) => {
  const queryClient = useQueryClient();
  const { tenant } = useTenant();

  // Form setup (EventFormType = input type so optional/default fields match zodResolver)
  const form = useForm<EventFormType>({
    resolver: zodResolver(EventSchema),
    defaultValues: {
      name: '',
      description: '',
      event_type: '',
      startdate: '',
      enddate: '',
      fees: 0,
      earlybird: null,
      early_date: null,
      regstart_date: null,
      regend: null,
      time: null,
      locationId: 0,
    },
  });

  const eventTypeWatch = form.watch('event_type');
  const isExternalEvent = eventTypeWatch === EXTERNAL_EVENT_TYPE;

  useEffect(() => {
    if (isExternalEvent) {
      form.setValue('earlybird', null);
      form.setValue('early_date', null);
    }
  }, [isExternalEvent, form]);

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

  // Populate form when editing
  useEffect(() => {
    if (event) {
      const formatDate = (date: Date | string | null): string => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toISOString().split('T')[0];
      };

      form.reset({
        name: event.name || '',
        description: event.description || '',
        event_type: event.event_type || '',
        startdate: formatDate(event.startdate),
        enddate: formatDate(event.enddate),
        fees: event.fees || 0,
        earlybird: event.earlybird ?? null,
        early_date: formatDate(event.early_date ?? null),
        regstart_date: formatDate(event.regstart_date ?? null),
        regend: formatDate(event.regend ?? null),
        time: event.time ?? null,
        locationId: event.locationId || 0,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        event_type: '',
        startdate: '',
        enddate: '',
        fees: 0,
        earlybird: null,
        early_date: null,
        regstart_date: null,
        regend: null,
        time: null,
        locationId: 0,
      });
    }
  }, [event, form]);

  // Clear form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        name: '',
        description: '',
        event_type: '',
        startdate: '',
        enddate: '',
        fees: 0,
        earlybird: null,
        early_date: null,
        regstart_date: null,
        regend: null,
        time: null,
        locationId: 0,
      });
    }
  }, [open, form]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: EventSchemaType) => {
      const url = event ? API_PATHS.eventManagement.events.byId(String(event.id)) : API_PATHS.eventManagement.events.list;
      const method = event ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const message = event 
        ? 'Event updated successfully' 
        : 'Event created successfully';

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

      queryClient.invalidateQueries({ queryKey: ['events'] });
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

  // Handle form submission (form uses EventFormType so fees may be undefined; normalize for API)
  const onSubmit = (data: EventFormType) => {
    const isExt = data.event_type === EXTERNAL_EVENT_TYPE;
    mutation.mutate({
      ...data,
      fees: data.fees ?? 0,
      ...(isExt ? { earlybird: null, early_date: null } : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {event ? 'Edit Event' : 'Add New Event'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Location */}
              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((location: import('@/types/domain').LocationSelectOption) => (
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

              {/* Event Type */}
              <FormField
                control={form.control}
                name="event_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value || '')}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Assessment">Assessment</SelectItem>
                        <SelectItem value="Camp">Camp</SelectItem>
                        <SelectItem value="Competition">Competition</SelectItem>
                        <SelectItem value="Showcase">Showcase</SelectItem>
                        <SelectItem value="Physical_Assessment">Physical Assessment</SelectItem>
                        <SelectItem value="fitness-assessment">Fitness Assessment</SelectItem>
                        <SelectItem value={EXTERNAL_EVENT_TYPE}>External (public registration, PayU)</SelectItem>
                      </SelectContent>
                    </Select>
                    {isExternalEvent && tenant?.academyCode && (
                      <FormDescription className="text-xs">
                        Public registration page:{' '}
                        <span className="font-mono break-all">{buildExternalEventRegistrationUrl(tenant.academyCode)}</span>
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter event description" 
                      {...field}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="startdate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="enddate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fees */}
              <FormField
                control={form.control}
                name="fees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fees</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          field.onChange(Number.isFinite(v) ? Math.max(0, v) : 0);
                        }}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Early Bird — not used for External events */}
              {!isExternalEvent && (
                <FormField
                  control={form.control}
                  name="earlybird"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Early Bird Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          min={0}
                          placeholder="Optional"
                          {...field}
                          onChange={(e) => {
                            if (!e.target.value) {
                              field.onChange(null);
                              return;
                            }
                            const v = parseFloat(e.target.value);
                            field.onChange(Number.isFinite(v) ? Math.max(0, v) : null);
                          }}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Early Date */}
              {!isExternalEvent && (
                <FormField
                  control={form.control}
                  name="early_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Early Bird Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Registration Start */}
              <FormField
                control={form.control}
                name="regstart_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Start</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Registration End */}
              <FormField
                control={form.control}
                name="regend"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration End</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Time */}
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input 
                      type="time" 
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional event time
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.status === 'pending'}
              >
                {mutation.status === 'pending' && (
                  <LoaderCircleIcon className="animate-spin mr-2 h-4 w-4" />
                )}
                {event ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EventEditDialog;

