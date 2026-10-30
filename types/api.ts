/**
 * API utilities and types
 */

/** Safely serialize BigInt values for JSON responses */
export function jsonBigInt<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as T;
}

/** Standard API error for catch blocks */
export interface ApiError extends Error {
  message: string;
  statusCode?: number;
}

/** Type guard for Error objects */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/** Extract error message from unknown error */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unexpected error';
}
