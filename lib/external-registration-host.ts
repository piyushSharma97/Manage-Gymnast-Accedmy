/**
 * Resolve academy code from public registration hostnames.
 *
 * Preferred: admin.external-event-registration.<academyCode>.<parent domain>
 * Legacy:    admin.register-gymnast.<academyCode>.<parent domain>
 */
const HOST_PREFIXES = ['admin.external-event-registration.', 'admin.register-gymnast.'] as const;

export function parseAcademyCodeFromHost(host: string): string | null {
  const h = host.split(':')[0].toLowerCase();
  for (const prefix of HOST_PREFIXES) {
    if (h.startsWith(prefix)) {
      const rest = h.slice(prefix.length);
      const academy = rest.split('.')[0]?.trim();
      if (academy) return academy;
    }
  }
  return null;
}
