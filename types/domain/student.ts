/**
 * Student domain types
 */

export interface StudentSelectOption {
  id: string | number;
  firstName: string;
  lastName: string | null;
  registrationNo: string;
}

export interface StudentGuardianWithRelation {
  id: string | number;
  guardianId: string | number;
  relation?: string | null;
  isPrimary: boolean;
  guardian?: {
    id: string | number;
    firstName: string;
    lastName: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, unknown> | null;
  };
}
