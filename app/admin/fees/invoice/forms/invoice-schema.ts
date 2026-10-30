import { z } from 'zod';

export const InvoiceSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  locationId: z.number().min(1, 'Please select a location'),
  courseId: z.number().optional().nullable(),
  batchId: z.number().optional().nullable(),
  amount: z.number().min(0, 'Amount must be 0 or greater').optional().nullable(),
  siblingDiscount: z
    .number()
    .min(0, 'Sibling discount must be 0 or greater')
    .optional()
    .nullable(),
  discount: z
    .number()
    .min(0, 'Discount must be 0 or greater')
    .optional()
    .nullable(),
  registration: z
    .number()
    .min(0, 'Registration must be 0 or greater')
    .optional()
    .nullable(),
  billingMonth: z.string().min(1, 'Please select billing date'),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['Pending', 'Paid', 'Overdue', 'PartiallyPaid']).optional(),
  paidAt: z.string().optional().nullable(),
});

export type InvoiceSchemaType = z.infer<typeof InvoiceSchema>;

