import { z } from 'zod';

export const EmployeeSchema = z.object({
  locationId: z.number().min(1, 'Please select a location'),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less'),
  lastName: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .refine((val) => /^\d{10}$/.test(val), 'Phone must be exactly 10 digits'),
  roleId: z.number().min(2).max(5, 'Please select a valid role'),
  hiredDate: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), 'Emergency contact phone must be exactly 10 digits'),
  // Coach → skill level mapping (multi-select when roleId is 5 / Coach)
  skillLevelIds: z.array(z.number().int().positive()).optional(),
});

export type EmployeeSchemaType = z.infer<typeof EmployeeSchema>;

// Role ID to role name mapping
export const ROLE_ID_MAP: Record<number, string> = {
  2: 'Admin',
  3: 'Manager',
  4: 'Staff',
  5: 'Coach',
};

// Role ID to EmployeeRole enum mapping (for database)
export const ROLE_ID_TO_ENUM_MAP: Record<number, 'Admin' | 'Manager' | 'Staff' | 'Coach'> = {
  2: 'Admin',
  3: 'Manager',
  4: 'Staff',
  5: 'Coach',
};

// EmployeeRole enum to Role ID mapping
export const ENUM_TO_ROLE_ID_MAP: Record<'Admin' | 'Manager' | 'Staff' | 'Coach', number> = {
  'Admin': 2,
  'Manager': 3,
  'Staff': 4,
  'Coach': 5,
};

