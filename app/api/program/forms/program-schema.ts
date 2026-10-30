import { z } from 'zod';

export const ProgramSchema = z.object({
  name: z
    .string()
    .nonempty({ message: 'Program name is required.' })
    .min(2, { message: 'Program name must be at least 2 characters long.' })
    .max(255, { message: 'Program name must not exceed 255 characters.' }),
  code: z
    .string()
    .optional()
    .refine((val) => !val || val.length <= 100, {
      message: 'Program code must not exceed 100 characters.',
    }),
  description: z
    .string()
    .optional()
    .refine((val) => !val || val.length <= 1000, {
      message: 'Description must not exceed 1000 characters.',
    }),
  ageMin: z
    .number()
    .int()
    .min(0, { message: 'Minimum age must be 0 or greater.' })
    .optional(),
  ageMax: z
    .number()
    .int()
    .min(0, { message: 'Maximum age must be 0 or greater.' })
    .optional(),
  durationWeeks: z
    .number()
    .int()
    .min(1, { message: 'Duration must be at least 1 week.' })
    .optional(),
  sessionType: z
    .string()
    .optional()
    .refine((val) => !val || val.length <= 100, {
      message: 'Session type must not exceed 100 characters.',
    }),
  isActive: z.boolean(),
});

export type ProgramSchemaType = z.infer<typeof ProgramSchema>;
