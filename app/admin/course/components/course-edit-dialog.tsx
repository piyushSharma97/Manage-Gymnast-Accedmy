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
import { CourseSchema, CourseSchemaType } from '../forms/course-schema';

type Course = {
  id: number;
  programId: number;
  courseName: string;
  sportCategoryId: number;
  classFrequency: number;
  perClass: number;
  monthly: number;
  quarterly: number;
  halfYearly: number;
  isActive: boolean;
  program: {
    id: number;
    name: string;
  };
};

type SportsCategory = {
  id: number;
  categoryName: string;
};

type Program = {
  id: number;
  name: string;
};

export interface CourseEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  course: Course | null;
}

const CourseEditDialog = ({
  open,
  closeDialog,
  course,
}: CourseEditDialogProps) => {
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<CourseSchemaType>({
    resolver: zodResolver(CourseSchema),
    defaultValues: {
      programId: 0,
      courseName: '',
      sportCategoryId: 0,
      classFrequency: 1,
      perClass: 0,
      monthly: 0,
      quarterly: 0,
      halfYearly: 0,
      isActive: true,
    },
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

  // Fetch sports categories for dropdown
  const { data: sportsCategories } = useQuery({
    queryKey: ['sports-categories-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.administration.sportsCategories.select);
      if (!response.ok) throw new Error('Failed to fetch sports categories');
      return response.json();
    },
    enabled: open,
  });

  // Update form when course changes
  useEffect(() => {
    if (open && course) {
      form.reset({
        programId: course.programId,
        courseName: course.courseName,
        sportCategoryId: course.sportCategoryId,
        classFrequency: course.classFrequency,
        perClass: course.perClass,
        monthly: course.monthly,
        quarterly: course.quarterly,
        halfYearly: course.halfYearly,
        isActive: course.isActive,
      });
    } else if (open && !course) {
      // Find gymnastics category ID for default selection
      const gymnasticsCategory = sportsCategories?.find(
        (cat: SportsCategory) => cat.categoryName.toLowerCase() === 'gymnastics'
      );
      const defaultSportCategoryId = gymnasticsCategory?.id || 0;

      form.reset({
        programId: 0,
        courseName: '',
        sportCategoryId: defaultSportCategoryId,
        classFrequency: 1,
        perClass: 0,
        monthly: 0,
        quarterly: 0,
        halfYearly: 0,
        isActive: true,
      });
    }
  }, [form, open, course, sportsCategories]);

  // Mutation for creating/updating course
  const mutation = useMutation({
    mutationFn: async (values: CourseSchemaType) => {
      const isEdit = !!course?.id;
      const url = isEdit
        ? API_PATHS.course.byId(String(course.id))
        : API_PATHS.course.list;
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
      const isEdit = !!course?.id;
      const message = isEdit
        ? 'Course updated successfully'
        : 'Course added successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
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
  const handleSubmit = (values: CourseSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {course ? 'Edit Course' : 'Add New Course'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        {programs?.map((program: Program) => (
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

              <FormField
                control={form.control}
                name="sportCategoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport Category *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sport category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sportsCategories?.map((category: SportsCategory) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.categoryName}
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
                name="courseName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter course name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="classFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Frequency (per week) *</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value ? String(field.value) : ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                            <SelectItem key={num} value={String(num)}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="perClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per Class Amount </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter per class amount"
                        {...field}
                        value={field.value === undefined || field.value === null ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monthly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per Month Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number" required
                        placeholder="Enter per monthly amount"
                        {...field}
                        value={field.value === undefined || field.value === null ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quarterly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per Quarter Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number" required
                        placeholder="Enter per quarterly amount"
                        {...field}
                        value={field.value === undefined || field.value === null ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="halfYearly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per Half Year Amount *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter per Half Yearly amount"
                        {...field}
                        value={field.value === undefined || field.value === null ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
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
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                {course ? 'Update Course' : 'Add Course'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CourseEditDialog;
