import { z } from 'zod';

export const PaymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  studentId: z.string().min(1, 'Please select a student'),
  locationId: z.number().min(1, 'Please select a location'),
  courseId: z.number().min(1, 'Please select a course'),
  paymentMode: z.string().optional().nullable(),
  orderid: z.string().optional().nullable(),
  txnid: z.string().optional().nullable(),
  amount: z.number().min(0, 'Amount must be 0 or greater'),
  amountPaid: z.number().min(0, 'Amount paid must be 0 or greater'),
  discount: z.number().min(0, 'Discount must be 0 or greater'),
  siblingDiscount: z.number().min(0, 'Sibling discount must be 0 or greater'),
  method: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  receivedAt: z.string().optional(),
});

export type PaymentSchemaType = z.infer<typeof PaymentSchema>;

