/**
 * Path-based public registration (no subdomains):
 *   {origin}/event-registration/{academyCode}
 *
 * Production with NEXT_PUBLIC_REGISTER_PARENT_DOMAIN (hostname only, e.g. myacademy.com):
 *   https://myacademy.com/event-registration/{academyCode}
 */

export const EXTERNAL_EVENT_REGISTER_PATH = '/event-registration';

function sanitizePathBase(): string {
  let b = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim();
  if (!b) return '';
  if (/^https?:\/\//i.test(b)) {
    try {
      return new URL(b).pathname.replace(/\/$/, '') || '';
    } catch {
      return '';
    }
  }
  if (!b.startsWith('/')) b = `/${b}`;
  return b.replace(/\/$/, '');
}

function joinBasePath(segment: string): string {
  const base = sanitizePathBase();
  return `${base}${segment}`.replace(/\/{2,}/g, '/');
}

/** Shareable link for admins (event dialog). */
export function buildExternalEventRegistrationUrl(academyCode: string): string {
  const code = academyCode.trim();
  if (!code) return '';

  const encoded = encodeURIComponent(code);
  const path = joinBasePath(`${EXTERNAL_EVENT_REGISTER_PATH}/${encoded}`);

  const parent = process.env.NEXT_PUBLIC_REGISTER_PARENT_DOMAIN?.trim();
  if (parent) {
    const host = parent.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return `https://${host}${path}`;
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}${path}`;
  }

  return path;
}

/** PayU / server redirects: success or failure pages under the same segment. */
export function getExternalRegistrationOutcomeUrl(
  origin: string,
  outcome: 'success' | 'failure',
  query?: Record<string, string>,
): string {
  const root = origin.replace(/\/$/, '');
  const path = joinBasePath(`${EXTERNAL_EVENT_REGISTER_PATH}/${outcome}`);
  const q = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : '';
  return `${root}${path}${q}`;
}
