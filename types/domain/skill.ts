/**
 * Skill domain types
 */

export interface SkillSelectOption {
  id: number;
  name: string;
  apparatus_name?: string;
  level?: string | null;
}

export interface ApparatusSelectOption {
  id: number;
  name: string;
  shortName?: string | null;
}
