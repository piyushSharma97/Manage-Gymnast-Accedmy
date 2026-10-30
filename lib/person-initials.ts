/** Two-letter initials for avatar chips (e.g. "Aarav Sharma" → "AS"). */
export function personInitials(firstName: string, lastName: string | null | undefined): string {
  const a = firstName?.trim().charAt(0) ?? '';
  const b = lastName?.trim().charAt(0) ?? '';
  const s = `${a}${b}`.toUpperCase();
  return s || '?';
}
