import { NextRequest } from 'next/server';

/**
 * apiFetch - universal fetch for dev/prod that prefixes API calls with the correct base URL
 *
 * Usage:
 *   apiFetch('/users', { method: 'GET' })
 *   apiFetch('https://external.com/endpoint') // untouched
 */
export async function apiFetch(
  input: string | Request,
  init?: RequestInit,
): Promise<Response> {
  let url = input;

  // If input is a string and is a relative API path, prefix with base URL
  if (typeof input === 'string') {
    if (input.startsWith('/api/')) {
      // Use empty string when BASE_PATH is undefined to avoid "undefined/api/..." (404 → HTML → JSON parse error)
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      const path = input.startsWith('/') ? input : '/' + input;
      url = base + path;
    }
  }
  // If input is a Request object, you could extend logic here if needed

  return fetch(url as RequestInfo, init);
}

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    //|| request.socket.remoteAddress
    'unknown'
  );
}
