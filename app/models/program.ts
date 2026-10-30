export interface Program {
  id: number;
  name: string;
  code?: string;
  description?: string;
  ageMin?: number;
  ageMax?: number;
  durationWeeks?: number;
  sessionType?: string;
  isActive: boolean;
  tenantId: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}
