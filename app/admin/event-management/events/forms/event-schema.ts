import { z } from 'zod';

export const EventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(250, 'Event name must be 250 characters or less'),
  description: z.string().min(1, 'Description is required'),
  event_type: z.string().min(1, 'Event type is required'),
  startdate: z.string().min(1, 'Start date is required'),
  enddate: z.string().min(1, 'End date is required'),
  fees: z.number().min(0, 'Fees cannot be negative').default(0),
  earlybird: z.number().min(0, 'Early bird price cannot be negative').optional().nullable(),
  early_date: z.string().optional().nullable(),
  regstart_date: z.string().optional().nullable(),
  regend: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
  locationId: z.number().min(1, 'Please select a location'),
}).refine((data) => {
  if (data.startdate && data.enddate) {
    const startDate = new Date(data.startdate);
    const endDate = new Date(data.enddate);
    return endDate >= startDate;
  }
  return true;
}, {
  message: 'End date must be after or equal to start date',
  path: ['enddate'],
});

export type EventSchemaType = z.infer<typeof EventSchema>;
/** Form values type (input) – use for useForm so optional/default fields match resolver */
export type EventFormType = z.input<typeof EventSchema>;

