'use client';

import { useEffect } from 'react';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { FitnessSkillSchema, FitnessSkillSchemaType } from '../forms/fitness-skill-schema';
import { API_PATHS } from '@/lib/api-paths';
import { useQuery } from '@tanstack/react-query';

type FitnessSkill = {
  id: number;
  name: string;
  fitnessCategoryId?: number;
  fitnessCategory?: { id: number; name: string };
  unitOfMeasurement: string;
};

export interface FitnessSkillEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  fitnessSkill: FitnessSkill | null;
  apiBasePath?: string;
  queryKey?: string;
}

const FitnessSkillEditDialog = ({
  open,
  closeDialog,
  fitnessSkill,
  apiBasePath = '/api/administration/fitness-skills',
  queryKey = 'admin-fitness-skills',
}: FitnessSkillEditDialogProps) => {
  const queryClient = useQueryClient();

  const form = useForm<FitnessSkillSchemaType>({
    resolver: zodResolver(FitnessSkillSchema),
    defaultValues: {
      name: '',
      fitnessCategoryId: 0,
      unitOfMeasurement: '',
    },
    mode: 'onSubmit',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['fitness-categories-select'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.administration.fitnessCategories.select);
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && fitnessSkill) {
      form.reset({
        name: fitnessSkill.name,
        fitnessCategoryId: fitnessSkill.fitnessCategoryId ?? fitnessSkill.fitnessCategory?.id ?? 0,
        unitOfMeasurement: fitnessSkill.unitOfMeasurement ?? '',
      });
    } else if (open && !fitnessSkill && (categories as { id: number }[]).length) {
      const firstId = (categories as { id: number }[])[0].id;
      form.reset({
        name: '',
        fitnessCategoryId: firstId,
        unitOfMeasurement: '',
      });
    }
  }, [form, open, fitnessSkill, categories]);

  const mutation = useMutation({
    mutationFn: async (values: FitnessSkillSchemaType) => {
      const isEdit = !!fitnessSkill?.id;
      const url = isEdit
        ? `${apiBasePath}/${fitnessSkill.id}`
        : apiBasePath;
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
      const isEdit = !!fitnessSkill?.id;
      const message = isEdit
        ? 'Fitness skill updated successfully'
        : 'Fitness skill added successfully';

      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );

      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
    },
  });

  const isLoading = mutation.status === 'pending';

  const handleSubmit = (values: FitnessSkillSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {fitnessSkill ? 'Edit Fitness Skill' : 'Add Fitness Skill'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skill Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Forward Roll" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fitnessCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(v) => field.onChange(parseInt(v, 10))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(categories as { id: number; name: string }[]).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
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
              name="unitOfMeasurement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of measurement</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. sec, reps, kg" {...field} />
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

export default FitnessSkillEditDialog;
