import { z } from 'zod';

export const TeamSchema = z.object({
  name: z
    .string()
    .nonempty({ message: 'Team name is required.' })
    .min(2, { message: 'Team name must be at least 2 characters long.' })
    .max(50, { message: 'Team name must not exceed 50 characters.' }),
  status: z
    .string()
    .max(20, { message: 'Status must not exceed 20 characters.' })
    .optional(),
});

export type TeamSchemaType = z.infer<typeof TeamSchema>;
