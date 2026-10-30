'use client';

import { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SkillLevelSchema = z.object({
	sportsId: z.number().min(1, 'Please select a sport'),
	levelName: z
		.string()
		.min(1, 'Level name is required')
		.max(50, 'Level name must be 50 characters or less'),
	description: z.string().optional(),
});

type SkillLevelSchemaType = z.infer<typeof SkillLevelSchema>;

type SkillLevel = {
	id: number;
	sportsId: number;
	levelName: string;
	levelCode: string;
	description: string | null;
	orderSequence: number;
	isActive: boolean;
	sportsCategory: {
		id: number;
		categoryName: string;
	};
};

type SportsCategory = {
	id: number;
	categoryName: string;
	isActive: boolean;
};

export interface SkillLevelEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  skillLevel: SkillLevel | null;
}

const SkillLevelEditDialog = ({
  open,
  closeDialog,
  skillLevel,
}: SkillLevelEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form initialization
  const form = useForm<SkillLevelSchemaType>({
    resolver: zodResolver(SkillLevelSchema),
    defaultValues: {
      sportsId: 0,
      levelName: '',
      description: '',
    },
    mode: 'onSubmit',
  });

  // Fetch sports categories for dropdown
  const { data: sportsCategories } = useQuery({
    queryKey: ['sports-categories-select'],
    queryFn: async () => {
      const response = await apiFetch('/api/administration/sports-categories/select');
      if (!response.ok) {
        throw new Error('Failed to load sports categories');
      }
      return response.json() as Promise<SportsCategory[]>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Reset form values when dialog is opened
  useEffect(() => {
    if (open) {
      form.reset({
        sportsId: skillLevel?.sportsId || 0,
        levelName: skillLevel?.levelName || '',
        description: skillLevel?.description ?? '',
      });
    }
  }, [form, open, skillLevel]);

  // Automatically select Gymnastics (or first active category) when adding a new skill level
  useEffect(() => {
    if (!open || skillLevel || !sportsCategories?.length) {
      return;
    }

    const currentValue = form.getValues('sportsId');
    if (currentValue && currentValue > 0) {
      return;
    }

    const defaultCategory =
      sportsCategories.find(
        (category) => category.categoryName.toLowerCase() === 'gymnastics',
      ) ||
      sportsCategories.find((category) => category.isActive) ||
      sportsCategories[0];

    if (defaultCategory) {
      form.setValue('sportsId', defaultCategory.id);
    }
  }, [form, open, skillLevel, sportsCategories]);

  // Mutation for creating/updating skill level
  const mutation = useMutation({
    mutationFn: async (values: SkillLevelSchemaType) => {
      const isEdit = !!skillLevel?.id;
      const url = isEdit
        ? `/api/administration/skilllevel/${skillLevel.id}`
        : '/api/administration/skilllevel';
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
      const isEdit = !!skillLevel?.id;
      const message = isEdit
        ? 'Skill level updated successfully'
        : 'Skill level added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-skill-levels'] });
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
  const handleSubmit = (values: SkillLevelSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {skillLevel ? 'Edit Skill Level' : 'Add Skill Level'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="sportsId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sport Category</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a sport category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sportsCategories?.map((category) => (
                        <SelectItem 
                          key={category.id} 
                          value={String(category.id)}
                          disabled={!category.isActive}
                        >
                          {category.categoryName}
                          {!category.isActive && ' (Inactive)'}
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
              name="levelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Beginner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Optional description of the skill level"
                      {...field}
                      value={field.value || ''}
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

export default SkillLevelEditDialog;
