import { z } from 'zod';

/** Legacy display levels for workout pages; grading criteria now define levels per skill */
export const FITNESS_LEVELS = ['L1A', 'L1B', 'L1C', 'L2', 'L3'] as const;

export const FitnessSkillSchema = z.object({
  name: z
    .string()
    .min(1, 'Skill name is required')
    .max(200, 'Skill name must be 200 characters or less'),
  fitnessCategoryId: z.number().min(1, 'Please select a category'),
  unitOfMeasurement: z
    .string()
    .min(1, 'Unit of measurement is required')
    .max(190, 'Unit must be 190 characters or less'),
});

export type FitnessSkillSchemaType = z.infer<typeof FitnessSkillSchema>;
