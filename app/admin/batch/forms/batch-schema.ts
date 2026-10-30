import { z } from 'zod';

export const BatchSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  programId: z.number().min(1, 'Please select a program'),
  paymentCycle: z.enum(['perClass', 'monthly', 'quarterly', 'halfYearly'], {
    required_error: 'Please select a payment cycle',
  }),
  courseId: z.number().min(1, 'Please select a course'),
  monday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  tuesday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  wednesday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  thursday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  friday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  saturday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  sunday: z.string().max(20, 'Time must be 20 characters or less').optional().nullable(),
  coachId: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    // At least one day must have a time
    return data.monday || data.tuesday || data.wednesday || data.thursday || 
           data.friday || data.saturday || data.sunday;
  },
  {
    message: 'At least one day of the week must have a time',
    path: ['monday'], // Error will show on monday field
  }
);

export type BatchSchemaType = z.infer<typeof BatchSchema>;
