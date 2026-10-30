'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import type { TenantWithSmtp } from '@/types/domain';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PhotoUpload } from '@/app/admin/gymnast-management/students/components/photo-upload';

// List of all Indian states
const INDIAN_STATES = [
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chhattisgarh',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal',
	'Andaman and Nicobar Islands',
	'Chandigarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Jammu and Kashmir',
	'Ladakh',
	'Lakshadweep',
	'Puducherry',
];

const TenantSchema = z.object({
	academyName: z.string().min(1, 'Academy name is required').max(100, 'Academy name must be 100 characters or less'),
	academyCode: z.string().min(1, 'Academy code is required').max(20, 'Academy code must be 20 characters or less'),
	website: z.string().url('Invalid website URL').optional().or(z.literal('')),
	logoUrl: z.string().optional().or(z.literal('')),
	primaryEmail: z.string().email('Invalid email address').max(100, 'Email must be 100 characters or less'),
	primaryPhone: z.string().min(1, 'Primary phone is required').max(20, 'Phone must be 20 characters or less'),
	addressLine1: z.string().min(1, 'Address line 1 is required').max(255, 'Address must be 255 characters or less'),
	addressLine2: z.string().optional(),
	city: z.string().min(1, 'City is required').max(100, 'City must be 100 characters or less'),
	state: z.string().min(1, 'State is required').max(100, 'State must be 100 characters or less'),
	postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code must be 20 characters or less'),
	subscriptionPlanId: z.number().min(1, 'Please select a subscription plan'),
	subscriptionStatus: z.enum(['active', 'suspended', 'cancelled', 'trial']).optional(),
	subscriptionStartDate: z.string().optional(),
	subscriptionEndDate: z.string().optional(),
	isActive: z.boolean().optional(),
  awsSMTPSecure: z.string().optional().or(z.literal('')),
  awsHost: z.string().optional().or(z.literal('')),
  awsPort: z.number().optional(),
  awsUsername: z.string().optional().or(z.literal('')),
  awsPassword: z.string().optional().or(z.literal('')),
});

type TenantSchemaType = z.infer<typeof TenantSchema>;

type Tenant = {
	id: number;
	academyName: string;
	academyCode: string;
	businessRegistrationNumber: string | null;
	taxId: string | null;
	website: string | null;
	logoUrl: string | null;
	primaryEmail: string;
	primaryPhone: string;
	addressLine1: string;
	addressLine2: string | null;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	timeZone: string;
	subscriptionPlanId: number;
	subscriptionStatus: 'active' | 'suspended' | 'cancelled' | 'trial';
	subscriptionStartDate: string;
	subscriptionEndDate: string;
	isActive: boolean;
	subscriptionPlan: {
		id: number;
		planName: string;
		description: string | null;
	};
};

type SubscriptionPlan = {
	id: number;
	planName: string;
	planCode: string;
	description: string | null;
	monthlyPrice: number;
	yearlyPrice: number;
	maxCenters: number;
	maxStudentsPerCenter: number;
	maxStaffPerCenter: number;
	isActive: boolean;
};

export interface TenantEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  tenant: Tenant | null;
}

const TenantEditDialog = ({
  open,
  closeDialog,
  tenant,
}: TenantEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form initialization
  const form = useForm<TenantSchemaType>({
    resolver: zodResolver(TenantSchema),
    defaultValues: { 
      academyName: '',
      academyCode: '',
      website: '',
      logoUrl: '',
      primaryEmail: '',
      primaryPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      subscriptionPlanId: 0,
      subscriptionStatus: 'trial',
      subscriptionStartDate: new Date().toISOString().split('T')[0],
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      awsSMTPSecure: '',
      awsHost: '',
      awsPort: undefined,
      awsUsername: '',
      awsPassword: '',
    },
    mode: 'onSubmit',
  });

  // Fetch subscription plans for dropdown
  const { data: subscriptionPlans } = useQuery({
    queryKey: ['subscription-plans-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.subscriptionPlans.select);
      if (!response.ok) {
        throw new Error('Failed to load subscription plans');
      }
      return response.json() as Promise<SubscriptionPlan[]>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Reset form values when dialog is opened
  useEffect(() => {
    if (open) {
      form.reset({
        academyName: tenant?.academyName || '',
        academyCode: tenant?.academyCode || '',
        website: tenant?.website || '',
        logoUrl: tenant?.logoUrl || '',
        primaryEmail: tenant?.primaryEmail || '',
        primaryPhone: tenant?.primaryPhone || '',
        addressLine1: tenant?.addressLine1 || '',
        addressLine2: tenant?.addressLine2 || '',
        city: tenant?.city || '',
        state: tenant?.state || '',
        postalCode: tenant?.postalCode || '',
        subscriptionPlanId: tenant?.subscriptionPlanId || 0,
        subscriptionStatus: tenant?.subscriptionStatus || 'trial',
        subscriptionStartDate: tenant?.subscriptionStartDate ? new Date(tenant.subscriptionStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        subscriptionEndDate: tenant?.subscriptionEndDate ? new Date(tenant.subscriptionEndDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: tenant?.isActive ?? true,
        awsSMTPSecure: (tenant as TenantWithSmtp)?.awsSMTPSecure || '',
        awsHost: (tenant as TenantWithSmtp)?.awsHost || '',
        awsPort: (tenant as TenantWithSmtp)?.awsPort || undefined,
        awsUsername: (tenant as TenantWithSmtp)?.awsUsername || '',
        awsPassword: (tenant as TenantWithSmtp)?.awsPassword || '',
      });
    }
  }, [form, open, tenant]);

  // Mutation for creating/updating tenant
  const mutation = useMutation({
    mutationFn: async (values: TenantSchemaType) => {
      const isEdit = !!tenant?.id;
      const url = isEdit
        ? API_PATHS.tenantManagement.byId(String(tenant.id))
        : API_PATHS.tenantManagement.list;
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
      const isEdit = !!tenant?.id;
      const message = isEdit
        ? 'Tenant updated successfully'
        : 'Tenant added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['tenant-management'] });
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
  const handleSubmit = (values: TenantSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent showCloseButton={false} className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {tenant ? 'Edit Tenant' : 'Add Tenant'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Academy Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Academy Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="academyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Elite Gymnastics Academy" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="academyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Academy Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., EGA001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

               
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo</FormLabel>
                      <FormControl>
                        <PhotoUpload
                          value={field.value || ''}
                          onChange={field.onChange}
                          label=""
                          directory="tenants"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@academy.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2</FormLabel>
                      <FormControl>
                        <Input placeholder="Suite 100 (Optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select
                        value={field.value || ''}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INDIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
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
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />           

              </div>
            </div>

            {/* Subscription Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Subscription Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subscriptionPlanId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Plan</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a subscription plan" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subscriptionPlans?.map((plan) => (
                            <SelectItem 
                              key={plan.id} 
                              value={String(plan.id)}
                              disabled={!plan.isActive}
                            >
                              {plan.planName}
                              {!plan.isActive && ' (Inactive)'}
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
                  name="subscriptionStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Status</FormLabel>
                      <Select
                        value={field.value || 'trial'}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subscriptionStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subscriptionEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subscription End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* AWS SMTP Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">AWS SMTP Configuration (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="awsSMTPSecure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Secure</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., tls, ssl" {...field} />
                      </FormControl>
                      <FormDescription>
                        Enter "tls" for STARTTLS, "ssl" for SSL/TLS, or leave empty
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="awsHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Host</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., email-smtp.us-east-1.amazonaws.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="awsPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Port</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 587, 465, 25" 
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="awsUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Username</FormLabel>
                      <FormControl>
                        <Input placeholder="AWS SMTP username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="awsPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SMTP Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="AWS SMTP password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Status */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this tenant
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !form.formState.isDirty}
              >
                {isLoading && <LoaderCircleIcon className="animate-spin" />}
                Submit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default TenantEditDialog;
