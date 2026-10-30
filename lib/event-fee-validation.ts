/** Parse event fee: must be finite and ≥ 0 (0 allowed). */
export function parseNonNegativeFee(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: 0 };
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) {
    return { ok: false, message: 'Fees must be a valid number' };
  }
  if (n < 0) {
    return { ok: false, message: 'Fees cannot be negative' };
  }
  return { ok: true, value: n };
}

/** Early bird / optional monetary fields: null or ≥ 0. */
export function parseOptionalNonNegativeFee(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) {
    return { ok: false, message: 'Amount must be a valid number' };
  }
  if (n < 0) {
    return { ok: false, message: 'Amount cannot be negative' };
  }
  return { ok: true, value: n };
}
