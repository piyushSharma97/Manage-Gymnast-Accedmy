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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import { Checkbox } from '@/components/ui/checkbox';
import { EmployeeSchema, EmployeeSchemaType, ROLE_ID_MAP, ENUM_TO_ROLE_ID_MAP } from '../forms/employee-schema';
import { PhotoUpload } from '@/app/admin/gymnast-management/students/components/photo-upload';
import type { LocationSelectOption, EmployeeWithProfilePhoto } from '@/types/domain';

type SkillLevelOption = { id: string; numericId: number; levelName: string };

type Employee = {
  id: number;
  locationId: number;
  userId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: 'Coach' | 'Admin' | 'Manager' | 'Staff';
  roleId?: number;
  hiredDate: string | null;
  isActive: boolean;
  location: {
    id: number;
    centerName: string;
  };
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  employeeSkillLevels?: Array<{
    skillLevel: { id: number; levelName: string; levelCode: string };
  }>;
};

export interface EmployeeEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  employee: Employee | null;
}

const EmployeeEditDialog = ({
  open,
  closeDialog,
  employee,
}: EmployeeEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<EmployeeSchemaType>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      locationId: 0,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      roleId: 4, // Default to Staff
      hiredDate: '',
      profilePhotoUrl: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      skillLevelIds: [] as number[],
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

  // Skill level options for mapping coaches (multi-select)
  const { data: skillLevels } = useQuery({
    queryKey: ['skill-levels-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.skillLevel.select);
      if (!response.ok) throw new Error('Failed to fetch skill level options');
      return response.json();
    },
    enabled: open,
  });

  const roleId = form.watch('roleId');
  const isCoach = roleId === 5;

  // Populate form when editing
  useEffect(() => {
    if (employee) {
      // Use roleId from employee if available (from API), otherwise map from role enum
      const roleId = employee.roleId ?? ENUM_TO_ROLE_ID_MAP[employee.role] ?? 4;
      
      const skillLevelIds =
        employee.employeeSkillLevels?.map((esl) => esl.skillLevel.id) ?? [];
      form.reset({
        locationId: employee.locationId,
        firstName: employee.firstName,
        lastName: employee.lastName || '',
        email: employee.email || '',
        phone: employee.phone || '',
        roleId: roleId,
        hiredDate: employee.hiredDate ? new Date(employee.hiredDate).toISOString().split('T')[0] : '',
        profilePhotoUrl: (employee as EmployeeWithProfilePhoto).profilePhotoUrl || '',
        emergencyContactName: employee.emergencyContactName || '',
        emergencyContactPhone: employee.emergencyContactPhone || '',
        skillLevelIds,
      });
    } else {
      form.reset({
        locationId: 0,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        roleId: 4,
        hiredDate: '',
        profilePhotoUrl: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        skillLevelIds: [],
      });
    }
  }, [employee, form]);

  // Build submit payload: include skillLevelIds only for coaches
  const buildSubmitData = (data: EmployeeSchemaType) => {
    const payload = { ...data };
    if (data.roleId !== 5) {
      delete (payload as Record<string, unknown>).skillLevelIds;
    }
    return payload;
  };

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: EmployeeSchemaType) => {
      const url = employee ? API_PATHS.employee.byId(String(employee.id)) : API_PATHS.employee.list;
      const method = employee ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildSubmitData(data)),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const message = employee 
        ? 'Employee updated successfully' 
        : 'Employee created successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
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

  // Handle form submission
  const onSubmit = (data: EmployeeSchemaType) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4">
          <DialogTitle>
            {employee ? 'Edit Employee' : 'Add New Employee'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6">
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
                        {locations?.map((location: LocationSelectOption) => (
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

              {/* Role */}
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="2">Admin</SelectItem>
                        <SelectItem value="3">Manager</SelectItem>
                        <SelectItem value="4">Staff</SelectItem>
                        <SelectItem value="5">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Map coach → skill levels (multi-select) */}
              {isCoach && (
                <FormField
                  control={form.control}
                  name="skillLevelIds"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Skill levels (multi-select)</FormLabel>
                      <p className="text-sm text-muted-foreground -mt-1 mb-1">
                        Map this coach to the skill levels they cover. Select one or more.
                      </p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal h-auto min-h-10 py-2 text-left"
                            >
                              {(() => {
                                const ids = field.value ?? [];
                                const opts = (skillLevels as SkillLevelOption[] | undefined) ?? [];
                                if (ids.length === 0) {
                                  return 'Select skill levels (multi-select)';
                                }
                                const names = ids
                                  .map((id) => opts.find((o) => o.numericId === id)?.levelName)
                                  .filter(Boolean) as string[];
                                if (names.length === 0) {
                                  return `${ids.length} skill level(s) mapped`;
                                }
                                const shown = names.slice(0, 3).join(', ');
                                const extra = names.length > 3 ? ` +${names.length - 3} more` : '';
                                return `${shown}${extra}`;
                              })()}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <div className="max-h-60 overflow-auto p-2">
                            {(skillLevels as SkillLevelOption[] | undefined)?.map((level) => (
                              <label
                                key={level.numericId}
                                className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-muted"
                              >
                                <Checkbox
                                  checked={field.value?.includes(level.numericId) ?? false}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ?? [];
                                    field.onChange(
                                      checked
                                        ? current.includes(level.numericId)
                                          ? current
                                          : [...current, level.numericId]
                                        : current.filter((id) => id !== level.numericId)
                                    );
                                  }}
                                />
                                <span>{level.levelName}</span>
                              </label>
                            ))}
                            {(!skillLevels || (skillLevels as unknown[]).length === 0) && (
                              <p className="text-sm text-muted-foreground py-2 px-2">
                                No skill levels defined for this tenant
                              </p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Last Name */}
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="Enter email address" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 10-digit phone number"
                        maxLength={10}
                        inputMode="numeric"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Emergency Contact Name */}
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter emergency contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Emergency Contact Phone */}
              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 10-digit phone number"
                        maxLength={10}
                        inputMode="numeric"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Hired Date */}
            <FormField
              control={form.control}
              name="hiredDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hired Date</FormLabel>
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

            {/* Profile Photo */}
            <FormField
              control={form.control}
              name="profilePhotoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Photo</FormLabel>
                  <FormControl>
                    <PhotoUpload
                      value={field.value || ''}
                      onChange={field.onChange}
                      label="Employee Photo"
                      directory="employees"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              </div>
            </ScrollArea>

            <DialogFooter className="px-6 py-4">
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
                {employee ? 'Update Employee' : 'Create Employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeEditDialog;

