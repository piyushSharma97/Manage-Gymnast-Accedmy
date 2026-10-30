'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrialSchema, TrialSchemaType } from '../forms/trial-schema';

type Trial = {
  id: number;
  participantName: string;
  parentName: string | null;
  phone: string | null;
  trialDate: string;
  trialTime: string;
  gender: string | null;
  email: string | null;
  type: string | null;
  age: number | null;
  instructor: string | null;
  other: string | null;
  tenant: {
    id: number;
    academyName: string;
  };
};

export interface TrialEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  trial: Trial | null;
}

const TrialEditDialog = ({
  open,
  closeDialog,
  trial,
}: TrialEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<TrialSchemaType>({
    resolver: zodResolver(TrialSchema),
    defaultValues: {
      participantName: '',
      parentName: '',
      phone: '',
      trialDate: '',
      trialTime: '',
      gender: undefined,
      email: '',
      type: 'Free Trial',
      age: undefined,
      instructor: '',
      other: '',
    },
  });

  // Helper function to convert 12-hour format (e.g., "6:00 pm") to 24-hour format (HH:mm)
  const convert12To24 = (time12: string): string => {
    if (!time12) return '';
    
    // Handle formats like "6:00 pm", "6:00 PM", "6:00pm", etc.
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/i);
    if (!match) {
      // If it's already in 24-hour format (HH:mm), return as is
      if (time12.match(/^\d{2}:\d{2}$/)) {
        return time12;
      }
      return '';
    }
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3].toLowerCase();
    
    if (ampm === 'pm' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Helper function to convert 24-hour format (HH:mm) to 12-hour format (e.g., "6:00 pm")
  const convert24To12 = (time24: string): string => {
    if (!time24) return '';
    
    const [hours, minutes] = time24.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return '';
    
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Update form when trial changes
  useEffect(() => {
    if (open && trial) {
      // Convert stored 12-hour format to 24-hour format for time input
      const time24 = convert12To24(trial.trialTime);
      
      form.reset({
        participantName: trial.participantName,
        parentName: trial.parentName || '',
        phone: trial.phone || '',
        trialDate: new Date(trial.trialDate).toISOString().split('T')[0],
        trialTime: time24,
        gender: trial.gender as any,
        email: trial.email || '',
        type: trial.type || '',
        age: trial.age || undefined,
        instructor: trial.instructor || '',
        other: trial.other || '',
      });
    } else if (open && !trial) {
      form.reset({
        participantName: '',
        parentName: '',
        phone: '',
        trialDate: '',
        trialTime: '',
        gender: undefined,
        email: '',
        type: 'Free Trial',
        age: undefined,
        instructor: '',
        other: '',
      });
    }
  }, [form, open, trial]);

  // Mutation for creating/updating trial
  const mutation = useMutation({
    mutationFn: async (values: TrialSchemaType) => {
      const isEdit = !!trial?.id;
      const url = isEdit
        ? `/api/trial/${trial.id}`
        : '/api/trial';
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
      const isEdit = !!trial?.id;
      const message = isEdit
        ? 'Trial updated successfully'
        : 'Trial added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-trials'] });
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
  const handleSubmit = (values: TrialSchemaType) => {
    // Convert time from 24-hour format (HH:mm) to 12-hour format (e.g., "6:00 pm")
    const time12 = convert24To12(values.trialTime);
    
    mutation.mutate({
      ...values,
      trialTime: time12,
    });
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {trial ? 'Edit Trial' : 'Add New Trial'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="participantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter participant name" maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter parent name" maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter phone number" 
                        maxLength={10}
                        type="tel"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" type="email" maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trialDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trialTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        step="1"
                        placeholder="Enter age"
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '') {
                            field.onChange(undefined);
                          } else {
                            const numValue = parseInt(value, 10);
                            if (!isNaN(numValue)) {
                              field.onChange(numValue);
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          // Prevent decimal point and negative sign
                          if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                            e.preventDefault();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
    <div>
            <FormLabel>Location</FormLabel>
            <LocationSelect onChange={(id) => form.setValue('locationId', id)} value={form.watch('locationId')} />
          </div>
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trial Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trial type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Free Trial">Free Trial</SelectItem>
                        <SelectItem value="Paid Trial">Paid Trial</SelectItem>
                        <SelectItem value="Demo">Demo</SelectItem>
                        <SelectItem value="Assessment">Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instructor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructor</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter instructor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            <FormField
              control={form.control}
              name="other"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes or comments"
                      className="resize-none"
                      {...field}
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
                {trial ? 'Update Trial' : 'Add Trial'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TrialEditDialog;
// Auxiliary select components
import { useState } from 'react';
import { useEffect as useEffect2 } from 'react';
function LocationSelect({ value, onChange }: { value?: number; onChange: (id: number) => void }) {
  const [options, setOptions] = useState<{ id: number; centerName: string }[]>([]);
  useEffect2(() => {
    apiFetch('/api/location/select').then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);
  return (
    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue placeholder="Select Location" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.centerName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}