/** Event type value stored in `events.event_type` for public PayU registration flow */
export const EXTERNAL_EVENT_TYPE = 'External';

export function isExternalEventType(eventType: string | null | undefined): boolean {
  return (eventType || '').trim() === EXTERNAL_EVENT_TYPE;
}
