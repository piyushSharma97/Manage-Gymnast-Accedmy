/**
 * Event domain types
 */

export interface EventSelectOption {
  id: number;
  name: string;
  event_type?: string | null;
  fees?: number;
  time?: string | null;
}
