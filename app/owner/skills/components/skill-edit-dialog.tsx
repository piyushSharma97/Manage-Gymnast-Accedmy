'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { LoaderCircleIcon, Check, ChevronsUpDown, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { SkillSchema, SkillSchemaType } from '../forms/skill-schema';

type Skill = {
  id: number;
  apparatus_id: number;
  apparatus_name: string;
  name: string;
  gender: string;
  color: string | null;
  level: string | null;
  status: string;
  tenant_id?: number | null;
};

type Tenant = {
  id: number;
  academyName: string;
  academyCode: string;
};

export interface SkillEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  skill: Skill | null;
}

const SkillEditDialog = ({
  open,
  closeDialog,
  skill,
}: SkillEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<SkillSchemaType>({
    resolver: zodResolver(SkillSchema),
    defaultValues: {
      apparatusId: 0,
      name: '',
      gender: 'Male',
      color: '',
      level: '',
      status: 'active',
      tenantId: 0,
    },
  });

  const [academyOpen, setAcademyOpen] = useState(false);

  // Fetch apparatus for dropdown
  const { data: apparatusList } = useQuery({
    queryKey: ['apparatus-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.apparatus.select);
      if (!response.ok) throw new Error('Failed to fetch apparatus');
      return response.json();
    },
    enabled: open,
  });

  // Fetch tenants for academy autocomplete
  const { data: tenantsList } = useQuery({
    queryKey: ['tenant-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.tenantManagement.select);
      if (!response.ok) throw new Error('Failed to fetch tenants');
      return response.json();
    },
    enabled: open,
  });

  // Update form when skill changes
  useEffect(() => {
    if (open && skill) {
      form.reset({
        apparatusId: skill.apparatus_id,
        name: skill.name,
        gender: skill.gender as 'Male' | 'Female' | 'Mixed',
        color: skill.color || '',
        level: skill.level || '',
        status: skill.status as 'active' | 'inactive',
        tenantId: skill.tenant_id || 0,
      });
    } else if (open && !skill) {
      form.reset({
        apparatusId: 0,
        name: '',
        gender: 'Male',
        color: '',
        level: '',
        status: 'active',
        tenantId: 0,
      });
    }
  }, [form, open, skill]);

  // Mutation for creating/updating skill
  const mutation = useMutation({
    mutationFn: async (values: SkillSchemaType) => {
      const isEdit = !!skill?.id;
      const url = isEdit
        ? API_PATHS.owner.skills.byId(String(skill.id))
        : API_PATHS.owner.skills.list;
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
      const isEdit = !!skill?.id;
      const message = isEdit
        ? 'Skill updated successfully'
        : 'Skill added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['owner-skills'] });
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
  const handleSubmit = (values: SkillSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {skill ? 'Edit Skill' : 'Add New Skill'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Academy *</FormLabel>
                    <Popover open={academyOpen} onOpenChange={setAcademyOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between',
                              (!field.value || field.value === 0) && 'text-muted-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <span className="truncate">
                                {field.value && field.value !== 0
                                  ? tenantsList?.find(
                                      (tenant: Tenant) => tenant.id === field.value
                                    )?.academyName
                                  : 'Select academy'}
                              </span>
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search academy..." />
                          <CommandList>
                            <CommandEmpty>No academy found.</CommandEmpty>
                            <CommandGroup>
                              {tenantsList?.map((tenant: Tenant) => (
                                <CommandItem
                                  value={tenant.academyName}
                                  key={tenant.id}
                                  onSelect={() => {
                                    field.onChange(tenant.id);
                                    setAcademyOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      'mr-2 h-4 w-4',
                                      field.value === tenant.id
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {tenant.academyName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {tenant.academyCode}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apparatusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apparatus *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select apparatus" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {apparatusList?.map((apparatus: any) => (
                          <SelectItem key={apparatus.id} value={apparatus.id.toString()}>
                            {apparatus.shortName || apparatus.name}
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter skill name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter color (e.g., Red, Blue)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional: Color code or name for this skill
                    </FormDescription>
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
                    <FormControl>
                      <Input placeholder="Enter level (e.g., Beginner, Advanced)" {...field} />
                    </FormControl>
                    <FormDescription>
                      Optional: Skill level or difficulty
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
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
                {skill ? 'Update Skill' : 'Add Skill'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SkillEditDialog;

