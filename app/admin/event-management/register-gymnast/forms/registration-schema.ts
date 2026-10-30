import { z } from 'zod';

export const RegistrationSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  eventId: z.string().min(1, 'Event is required'),
  Fees: z.coerce.number().min(0),
  EarlyBirdDisc: z.number().min(0).optional().nullable(),
  SiblingDisc: z.number().min(0).optional().nullable(),
  Additional: z.number().optional().nullable(),
  Total: z.coerce.number().min(0),
  PaymentMode: z.string().min(1, 'Payment Mode is required'),
  Comments: z.string().optional().nullable(),
  Status: z.string().min(1),
  depositdate: z.string().optional().nullable(),
  level: z.string().optional().nullable(),
  eventtype: z.string().optional().nullable(),
  timing: z.string().optional().nullable(),
  txnid: z.string().optional().nullable(),
});

export type RegistrationSchemaType = z.infer<typeof RegistrationSchema>;