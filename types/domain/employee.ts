/**
 * Employee domain types
 */

export interface EmployeeSelectOption {
  id: number;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
}

export interface EmployeeWithProfilePhoto extends Record<string, unknown> {
  profilePhotoUrl?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}
