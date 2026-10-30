import { z } from 'zod';

export const LocationSchema = z.object({
  tenantId: z.number().optional(),
  centerName: z.string().min(1, 'Center name is required').max(100, 'Center name must be 100 characters or less'),
  centerCode: z.string().min(1, 'Center code is required').max(20, 'Center code must be 20 characters or less'),
  email: z.string().email('Invalid email format').max(100, 'Email must be 100 characters or less').optional().or(z.literal('')),
  phone: z.string()
    .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits')
    .optional()
    .or(z.literal('')),
  addressLine1: z.string().max(200, 'Address line 1 must be 200 characters or less').optional().or(z.literal('')),
  addressLine2: z.string().max(200, 'Address line 2 must be 200 characters or less').optional().or(z.literal('')),
  city: z.string().max(50, 'City must be 50 characters or less').optional().or(z.literal('')),
  state: z.string().max(50, 'State must be 50 characters or less').optional().or(z.literal('')),
  postalCode: z.string().max(20, 'Postal code must be 20 characters or less').optional().or(z.literal('')),
  managerName: z.string().max(100, 'Manager name must be 100 characters or less').optional().or(z.literal('')),
  managerPhone: z.string()
    .regex(/^\d{10}$/, 'Manager phone number must be exactly 10 digits')
    .optional()
    .or(z.literal('')),
  managerEmail: z.string().email('Invalid manager email format').max(100, 'Manager email must be 100 characters or less').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type LocationSchemaType = z.infer<typeof LocationSchema>;
