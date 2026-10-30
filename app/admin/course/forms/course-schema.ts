import { z } from 'zod';

export const CourseSchema = z.object({
  programId: z.number().min(1, 'Please select a program'),
  courseName: z.string().min(1, 'Course name is required').max(100, 'Course name must be 100 characters or less'),
  
  sportCategoryId: z.number().min(1, 'Please select a sport category'),
  classFrequency: z.number().min(1, 'Class frequency must be at least 1'),
  perClass: z.number().min(0, 'Per class amount must be 0 or greater'),
  monthly: z.number().min(0, 'Monthly amount must be 0 or greater'),
  quarterly: z.number().min(0, 'Quarterly amount must be 0 or greater'),
  halfYearly: z.number().min(0, 'Half yearly amount must be 0 or greater'),
  isActive: z.boolean().optional(),
});

export type CourseSchemaType = z.infer<typeof CourseSchema>;
