const STORAGE_KEY_PREFIX = 'cmg:parent:selectedStudent:v1';

export function parentSelectedStudentStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

export function readParentSelectedStudentId(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(parentSelectedStudentStorageKey(userId));
    if (raw == null || raw === '') return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeParentSelectedStudentId(userId: string, studentId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(parentSelectedStudentStorageKey(userId), studentId);
  } catch {
    /* ignore quota / private mode */
  }
}
