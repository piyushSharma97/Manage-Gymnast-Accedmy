import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseAcademyCodeFromHost } from '@/lib/external-registration-host';

export type PublicRegistrationTenant = {
  id: number;
  academyName: string;
  academyCode: string;
  payuMerchantKey: string | null;
  payuMerchantSalt: string | null;
};

export async function resolveTenantForPublicRegistration(
  request: NextRequest,
): Promise<PublicRegistrationTenant | null> {
  const forwarded = request.headers.get('x-forwarded-host');
  const host = (forwarded?.split(',')[0]?.trim() || request.headers.get('host') || '').split(':')[0];
  const fromHost = parseAcademyCodeFromHost(host);
  const fromQuery = new URL(request.url).searchParams.get('academyCode')?.trim();
  const fromHeader = request.headers.get('x-academy-code')?.trim();
  const slug = fromHost || fromQuery || fromHeader;
  if (!slug) return null;

  const candidates = [slug, slug.toUpperCase(), slug.toLowerCase()];
  const variants: string[] = [];
  for (const c of candidates) {
    if (!variants.includes(c)) variants.push(c);
  }
  for (const code of variants) {
    const tenant = await prisma.tenant.findFirst({
      where: { academyCode: code, isActive: true },
      // Fields exist on Tenant in schema; regenerate client with `npx prisma generate` for strict typing.
      select: {
        id: true,
        academyName: true,
        academyCode: true,
        payuMerchantKey: true,
        payuMerchantSalt: true,
      } as any,
    });
    if (tenant) return tenant as unknown as PublicRegistrationTenant;
  }
  return null;
}

/**
 * Resolve an active tenant by academy code from a URL segment or query (e.g. path param).
 * Tries exact, upper-cased, and lower-cased variants to match stored `academyCode`.
 */
export async function findActiveTenantByAcademyCode(
  academyCodeRaw: string,
): Promise<PublicRegistrationTenant | null> {
  const trimmed = academyCodeRaw.trim();
  if (!trimmed) return null;

  const candidates = [trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()];
  const variants: string[] = [];
  for (const c of candidates) {
    if (!variants.includes(c)) variants.push(c);
  }

  for (const code of variants) {
    const tenant = await prisma.tenant.findFirst({
      where: { academyCode: code, isActive: true },
      select: {
        id: true,
        academyName: true,
        academyCode: true,
        payuMerchantKey: true,
        payuMerchantSalt: true,
      } as any,
    });
    if (tenant) return tenant as unknown as PublicRegistrationTenant;
  }
  return null;
}

export function isEventRegistrationOpen(event: {
  regstart_date: Date | null;
  regend: Date | null;
}): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (event.regstart_date) {
    const s = new Date(event.regstart_date);
    s.setHours(0, 0, 0, 0);
    if (today < s) return false;
  }
  if (event.regend) {
    const e = new Date(event.regend);
    e.setHours(0, 0, 0, 0);
    if (today > e) return false;
  }
  return true;
}

/** Today’s calendar day falls within the event run (startdate–enddate inclusive). */
export function isEventActiveOnReferenceDate(
  event: { startdate: Date; enddate: Date },
  reference: Date = new Date(),
): boolean {
  const day = new Date(reference);
  day.setHours(0, 0, 0, 0);
  const start = new Date(event.startdate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(event.enddate);
  end.setHours(0, 0, 0, 0);
  return day >= start && day <= end;
}

export function resolvePayuCredentials(tenant: {
  payuMerchantKey: string | null;
  payuMerchantSalt: string | null;
}): { key: string; salt: string } | null {
  const key = tenant.payuMerchantKey?.trim() || process.env.PAYU_MERCHANT_KEY?.trim();
  const salt = tenant.payuMerchantSalt?.trim() || process.env.PAYU_MERCHANT_SALT?.trim();
  if (!key || !salt) return null;
  return { key, salt };
}

export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'Participant', lastName: '-' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
