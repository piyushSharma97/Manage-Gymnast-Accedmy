/** Extract first number from achieved value for charts / averages (e.g. "12 reps" → 12). */
export function parseAchievedNumeric(value: string | null | undefined): number {
  if (value == null || String(value).trim() === '') return 0;
  const m = String(value).match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}
