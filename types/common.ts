/**
 * Common shared types used across the application
 */

/** Generic select option for dropdowns */
export interface SelectOption<T = string> {
  id: T;
  label: string;
  value?: string;
}

/** Generic entity with id for list items */
export interface EntityWithId {
  id: string | number;
}

/** Address structure used in forms */
export interface Address {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
