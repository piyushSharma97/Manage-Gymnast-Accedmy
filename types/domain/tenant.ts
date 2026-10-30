/**
 * Tenant domain types
 */

export interface TenantWithSmtp extends Record<string, unknown> {
  awsSMTPSecure?: string | null;
  awsHost?: string | null;
  awsPort?: number | null;
  awsUsername?: string | null;
  awsPassword?: string | null;
}
