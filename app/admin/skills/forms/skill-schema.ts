import { z } from 'zod';

export const SkillSchema = z.object({
  apparatusId: z.number().min(1, 'Please select an apparatus'),
  name: z.string().min(1, 'Skill name is required').max(200, 'Skill name must be 200 characters or less'),
  gender: z.enum(['Male', 'Female', 'Mixed'], {
    required_error: 'Please select a gender',
  }),
  color: z.string().max(10, 'Color must be 10 characters or less').optional().or(z.literal('')),
  level: z.string().max(10, 'Level must be 10 characters or less').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive'], {
    required_error: 'Please select a status',
  }),
});

export type SkillSchemaType = z.infer<typeof SkillSchema>;

