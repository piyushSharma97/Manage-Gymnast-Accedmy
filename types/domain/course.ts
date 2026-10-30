/**
 * Course domain types
 */

export interface CourseSelectOption {
  id: number;
  courseName: string;
  courseCode?: string | null;
  feeAmount?: number | null;
}
