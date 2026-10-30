import { z } from 'zod';

export const TrialSchema = z.object({
  participantName: z.string().min(1, 'Participant name is required').max(100, 'Participant name must be 100 characters or less'),
  parentName: z.string().max(100, 'Parent name must be 100 characters or less').optional(),
  phone: z.string().max(10, 'Phone number must be 10 digits or less').regex(/^\d*$/, 'Phone number must contain only digits').optional(),
  trialDate: z.string().min(1, 'Trial date is required'),
  trialTime: z.string().min(1, 'Trial time is required'),
  gender: z.enum(['Male', 'Female', 'Mixed']).optional(), 
  email: z.union([
    z.string().max(100, 'Email must be 100 characters or less').email('Invalid email address'),
    z.literal('')
  ]).optional(),
  type: z.string().optional(),
  age: z.number().int('Age must be a whole number').min(0, 'Age must be 0 or greater').max(70, 'Age must be 120 or less').optional(),
  instructor: z.string().optional(),
  other: z.string().optional(),
  locationId: z.number().optional(),
});

export type TrialSchemaType = z.infer<typeof TrialSchema>;
