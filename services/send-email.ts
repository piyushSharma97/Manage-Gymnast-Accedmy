import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

const BRAND_NAME = 'My Academy';

export interface SendEmailContent {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  /** Override signature line, e.g. "Regards, My Academy Team" (default) or "Regards, Academy Name" */
  signatureName?: string;
  /** Academy/organization logo URL for header (e.g. invoice emails) */
  logoUrl?: string | null;
  /** Header display name when logo present (e.g. academy name) */
  headerName?: string | null;
}

export enum EmailTemplateType {
  /** Owner welcomes new academy admin - use supportEmail = sender (platform) email */
  WELCOME_TENANT = 'WELCOME_TENANT',
  /** Password reset requested by user */
  PASSWORD_RESET = 'PASSWORD_RESET',
  /** Set new password (students, employees, etc.) */
  PASSWORD_SETUP = 'PASSWORD_SETUP',
  /** Welcome new employee with login credentials */
  WELCOME_EMPLOYEE = 'WELCOME_EMPLOYEE',
  /** Invoice or payment notification */
  INVOICE = 'INVOICE',
  /** Generic customizable email */
  CUSTOM = 'CUSTOM',
}

type WelcomeTenantTemplateData = {
  academyName: string;
  passwordSetupUrl: string;
  /** Sender/support email (platform) - NOT receiver. Use env SMTP_FROM when owner sends. */
  supportEmail?: string;
};

type PasswordResetTemplateData = {
  recipientName: string;
  resetUrl: string;
  supportEmail?: string;
};

type PasswordSetupTemplateData = {
  recipientName: string;
  passwordSetupUrl: string;
  supportEmail?: string;
  tempPassword?: string;
};

type WelcomeEmployeeTemplateData = {
  recipientName: string;
  passwordSetupUrl: string;
  supportEmail?: string;
  tempPassword?: string;
};

type InvoiceTemplateData = {
  recipientName: string;
  invoiceUrl?: string;
  amount?: string;
  description?: string;
  supportEmail?: string;
};

type CustomTemplateData = SendEmailContent & { subject: string };

export type EmailTemplateDescriptor =
  | { type: EmailTemplateType.WELCOME_TENANT; data: WelcomeTenantTemplateData }
  | { type: EmailTemplateType.PASSWORD_RESET; data: PasswordResetTemplateData }
  | { type: EmailTemplateType.PASSWORD_SETUP; data: PasswordSetupTemplateData }
  | { type: EmailTemplateType.WELCOME_EMPLOYEE; data: WelcomeEmployeeTemplateData }
  | { type: EmailTemplateType.INVOICE; data: InvoiceTemplateData }
  | { type: EmailTemplateType.CUSTOM; data: CustomTemplateData };

export interface SendEmailProps {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  content?: SendEmailContent;
  tenantId?: number | null;
  fromEmail?: string;
  fromName?: string;
  template?: EmailTemplateDescriptor;
  /** When true, use only env SMTP (e.g. .env.production) and sender "My Academy Team". Use for owner-sent emails (e.g. welcome to new academy). */
  usePlatformSmtp?: boolean;
}

type ResolvedTemplate = {
  subject: string;
  content: SendEmailContent;
};

type SmtpTransportOptions = {
  host: string;
  port: number;
  secure?: boolean;
  requireTLS?: boolean;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  auth: {
    user: string;
    pass: string;
  };
};

type SmtpConfig = {
  transport: SmtpTransportOptions;
  senderEmail: string;
  senderName?: string | null;
  /** True when tenant (academy) SMTP was used; enables fallback to owner env on auth failure */
  usedTenantSmtp?: boolean;
};

export async function sendEmail({
  to,
  subject,
  text,
  html,
  content,
  tenantId,
  fromEmail,
  fromName,
  template,
  usePlatformSmtp = false,
}: SendEmailProps) {
  // Academy work (admin, employee, parent): first academy SMTP from table, else owner SMTP from env
  const smtpConfig = await resolveSmtpConfig(usePlatformSmtp ? undefined : tenantId);

  // Contact email: academy email when using academy SMTP, else owner env
  const contactEmail = smtpConfig.senderEmail;
  // Signature: Academy Name when admin/manager sends (tenant context), else My Academy Team
  const defaultSignatureName = usePlatformSmtp
    ? `${BRAND_NAME} Team`
    : (smtpConfig.senderName ?? `${BRAND_NAME} Team`);

  const resolvedTemplate = resolveTemplate(template, { contactEmail, defaultSignatureName });
  const finalSubject = resolvedTemplate?.subject ?? subject;
  let finalContent = resolvedTemplate?.content ?? content ?? {};

  // For content (non-template): inject Academy Name as signature and contact email when admin sends
  if (!resolvedTemplate) {
    if (!finalContent.signatureName && !usePlatformSmtp && smtpConfig.senderName) {
      finalContent = { ...finalContent, signatureName: smtpConfig.senderName };
    }
    // Append contact email for "contact us" when admin sends and description exists
    if (
      !usePlatformSmtp &&
      contactEmail &&
      finalContent.description &&
      !finalContent.description.includes(contactEmail)
    ) {
      finalContent = {
        ...finalContent,
        description: `${finalContent.description}\n\nFor help, contact us at ${contactEmail}.`,
      };
    }
  }

  if (!finalSubject) {
    throw new Error('Email subject is required.');
  }

  const emailHtml = html ?? buildDefaultEmailHtml(finalSubject, finalContent);
  const messageText =
    text ?? finalContent.description ?? 'Please view this email in HTML format.';

  try {
    const transporter = nodemailer.createTransport(smtpConfig.transport);

    // Always use smtpConfig for from - ensures correct sender when academy has no SMTP (uses env)
    const resolvedFromEmail = fromEmail ?? smtpConfig.senderEmail;
    const resolvedFromName = usePlatformSmtp
      ? `${BRAND_NAME} Team`
      : (fromName ?? smtpConfig.senderName ?? BRAND_NAME);

    const from =
      resolvedFromName && resolvedFromEmail
        ? `${resolvedFromName} <${resolvedFromEmail}>`
        : resolvedFromEmail;

    console.log(`Attempting to send email:`, {
      to,
      from,
      subject: finalSubject,
      smtpHost: smtpConfig.transport.host,
      smtpPort: smtpConfig.transport.port,
      tenantId: tenantId ?? 'none',
    });

    await transporter.sendMail({
      from,
      to,
      subject: finalSubject,
      text: messageText,
      html: emailHtml,
    });

    console.log(`Email sent successfully to ${to} (tenant: ${tenantId ?? 'default'})`);
  } catch (error: unknown) {
    interface ErrWithCode {
      message?: string;
      code?: string;
      response?: string;
      port?: number;
    }
    const err: ErrWithCode = error && typeof error === 'object' ? (error as ErrWithCode) : {};
    console.error(`Error sending email to ${to}:`, error);

    // If academy SMTP failed (auth, connection, timeout), retry with owner (env) SMTP
    const academyFailedCodes = ['EAUTH', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION'];
    if (
      err?.code &&
      academyFailedCodes.includes(err.code) &&
      smtpConfig.usedTenantSmtp &&
      !usePlatformSmtp
    ) {
      console.warn(
        `Academy SMTP failed (${err.code}), retrying with owner (env) SMTP`,
      );
      try {
        const platformConfig = await resolveSmtpConfig(undefined);
        const fallbackTransporter = nodemailer.createTransport(
          platformConfig.transport,
        );
        const resolvedFromEmail = fromEmail ?? platformConfig.senderEmail;
        const resolvedFromName = `${BRAND_NAME} Team`;
        const fallbackFrom =
          resolvedFromName && resolvedFromEmail
            ? `${resolvedFromName} <${resolvedFromEmail}>`
            : resolvedFromEmail;

        await fallbackTransporter.sendMail({
          from: fallbackFrom,
          to,
          subject: finalSubject,
          text: messageText,
          html: emailHtml,
        });
        console.log(`Email sent successfully to ${to} (owner SMTP fallback)`);
        return;
      } catch (retryError: unknown) {
        console.error('Owner SMTP fallback also failed:', retryError);
        const retryErr = retryError && typeof retryError === 'object' ? (retryError as ErrWithCode) : {};
        const detail =
          retryErr?.code && retryErr?.message
            ? ` (${retryErr.code}: ${retryErr.message})`
            : retryError instanceof Error
              ? ` (${retryError.message})`
              : '';
        throw new Error(
          `Failed to send email: Academy SMTP failed and owner SMTP fallback also failed.${detail} Check academy SMTP (Owner → Tenant management) and server .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE.`,
        );
      }
    }

    console.error('Error details:', {
      message: err?.message,
      code: err?.code,
      response: err?.response,
      tenantId,
    });

    // Provide helpful error messages for common issues
    let errorMessage = err?.message || 'Unknown error';
    
    if (err?.code === 'ESOCKET' || err?.code === 'ETIMEDOUT') {
      if (err?.port === 25) {
        errorMessage = 'Connection timeout on port 25. Port 25 is often blocked by ISPs and cloud providers. Please configure SMTP_PORT to use 587 (STARTTLS) or 465 (SSL) instead.';
      } else {
        errorMessage = `Connection timeout (${err?.code}). Please check your SMTP_HOST, SMTP_PORT environment variables and network connectivity. For AWS SES, use port 587 (STARTTLS) or 465 (SSL).`;
      }
    } else if (err?.code === 'EAUTH') {
      errorMessage =
        'SMTP authentication failed. Please check SMTP credentials (owner env or academy SMTP settings).';
    } else if (err?.code === 'ECONNECTION') {
      errorMessage = 'Failed to connect to SMTP server. Please check your SMTP_HOST and SMTP_PORT environment variables.';
    }

    // Re-throw the error so the caller knows email failed
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}

function buildDefaultEmailHtml(
  subject: string,
  content: SendEmailContent,
): string {
  const { title, subtitle, description, buttonLabel, buttonUrl, signatureName, logoUrl, headerName } = content;
  const signature = signatureName ?? `${BRAND_NAME} Team`;
  const headerDisplay = headerName ?? BRAND_NAME;
  const headerHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${headerDisplay}" style="max-height:48px;max-width:200px;height:auto;display:block;margin:0 auto;" />`
    : `<h1 style="margin:0;font-size:24px;">${headerDisplay}</h1>`;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:24px;background-color:#f6f6f6;font-family:Arial,sans-serif;color:#1f1f1f;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f6f6;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:24px;text-align:center;background-color:#111827;color:#ffffff;">
                  ${headerHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:32px;text-align:left;">
                  ${
                    title
                      ? `<h2 style="margin:0 0 16px;font-size:22px;color:#111827;">${title}</h2>`
                      : ''
                  }
                  ${
                    subtitle
                      ? `<p style="margin:0 0 16px;font-size:16px;color:#374151;">${subtitle}</p>`
                      : ''
                  }
                  ${
                    buttonLabel && buttonUrl
                      ? `<p style="margin:32px 0;text-align:center;">
                      <a href="${buttonUrl}" style="display:inline-block;padding:12px 28px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:16px;">
                        ${buttonLabel}
                      </a>
                    </p>`
                      : ''
                  }
                  ${
                    description
                      ? `<div style="margin:16px 0;font-size:16px;color:#374151;line-height:1.6;">${description}</div>`
                      : ''
                  }
                  <p style="margin-top:32px;font-size:14px;color:#6b7280;">
                    Regards,<br />${signature}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

type TemplateContext = {
  contactEmail: string;
  defaultSignatureName: string;
};

function resolveTemplate(
  template?: EmailTemplateDescriptor,
  context?: TemplateContext,
): ResolvedTemplate | null {
  if (!template) {
    return null;
  }

  const defaultSupport =
    context?.contactEmail ??
    (process.env.SMTP_FROM || process.env.SMTP_USER || 'support@myacademy.com');
  const defaultSignature = context?.defaultSignatureName ?? `${BRAND_NAME} Team`;

  switch (template.type) {
    case EmailTemplateType.WELCOME_TENANT: {
      const supportEmail = template.data.supportEmail ?? defaultSupport;
      return {
        subject: `Welcome to ${BRAND_NAME}, ${template.data.academyName}!`,
        content: {
          title: `Welcome aboard, ${template.data.academyName}!`,
          subtitle:
            'Your academy is now part of My Academy. Use the button below to set your administrator password and finalize onboarding.',
          buttonLabel: 'Set New Password',
          buttonUrl: template.data.passwordSetupUrl,
          description: `The link expires in 48 hours. If you need a new link, please contact us at ${supportEmail}.`,
          signatureName: defaultSignature,
        },
      };
    }
    case EmailTemplateType.PASSWORD_RESET: {
      const supportEmail = template.data.supportEmail ?? defaultSupport;
      return {
        subject: 'Password Reset Request',
        content: {
          title: `Hello, ${template.data.recipientName}`,
          subtitle:
            'You requested a password reset. Click the link below to reset your password.',
          buttonLabel: 'Reset password',
          buttonUrl: template.data.resetUrl,
          description: `This link is valid for 1 hour. If you did not request this email, you can safely ignore it. For help, contact us at ${supportEmail}.`,
          signatureName: defaultSignature,
        },
      };
    }
    case EmailTemplateType.PASSWORD_SETUP: {
      const supportEmail = template.data.supportEmail ?? defaultSupport;
      const desc = template.data.tempPassword
        ? `Your temporary password is: ${template.data.tempPassword}\n\nYou can use this to log in, or click the button above to set a new password. The link expires in 48 hours. For help, contact us at ${supportEmail}.`
        : `Use the button above to set your password. The link expires in 48 hours. For help, contact us at ${supportEmail}.`;
      return {
        subject: 'Set Your Password',
        content: {
          title: `Hello, ${template.data.recipientName}`,
          subtitle: 'Your account has been created. Click below to set your password.',
          buttonLabel: 'Set New Password',
          buttonUrl: template.data.passwordSetupUrl,
          description: desc,
          signatureName: defaultSignature,
        },
      };
    }
    case EmailTemplateType.WELCOME_EMPLOYEE: {
      const supportEmail = template.data.supportEmail ?? defaultSupport;
      const desc = template.data.tempPassword
        ? `Your temporary password is: ${template.data.tempPassword}\n\nYou can use this to log in, or click the button above to set a new password. The link expires in 48 hours. For help, contact us at ${supportEmail}.`
        : `Click the button above to set your password. The link expires in 48 hours. For help, contact us at ${supportEmail}.`;
      return {
        subject: 'Welcome! Your Account Credentials',
        content: {
          title: `Hello, ${template.data.recipientName}`,
          subtitle: 'Your account has been created. Use the button below to set your password.',
          buttonLabel: 'Set New Password',
          buttonUrl: template.data.passwordSetupUrl,
          description: desc,
          signatureName: defaultSignature,
        },
      };
    }
    case EmailTemplateType.INVOICE: {
      const supportEmail = template.data.supportEmail ?? defaultSupport;
      const desc =
        template.data.description ||
        (template.data.amount
          ? `Amount due: ${template.data.amount}. ${template.data.invoiceUrl ? 'View your invoice using the link below.' : ''}`
          : '');
      return {
        subject: template.data.amount ? `Invoice: ${template.data.amount}` : 'Invoice Notification',
        content: {
          title: `Hello, ${template.data.recipientName}`,
          subtitle: desc,
          buttonLabel: template.data.invoiceUrl ? 'View Invoice' : undefined,
          buttonUrl: template.data.invoiceUrl,
          description: template.data.invoiceUrl
            ? `For questions, contact us at ${supportEmail}.`
            : undefined,
          signatureName: defaultSignature,
        },
      };
    }
    case EmailTemplateType.CUSTOM: {
      const d = template.data as CustomTemplateData;
      return {
        subject: d.subject,
        content: {
          title: d.title,
          subtitle: d.subtitle,
          description: d.description,
          buttonLabel: d.buttonLabel,
          buttonUrl: d.buttonUrl,
          signatureName: d.signatureName ?? defaultSignature,
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Resolve SMTP config for sending email.
 * Used for academy-related flows: admin, employee (coach, staff, manager), parent/child.
 *
 * Order:
 * 1. If tenantId is provided: check academy SMTP from Tenant table (awsHost, awsUsername, awsPassword).
 *    Use academy SMTP only when tenant is active and all three are set.
 * 2. If academy SMTP is not available (no tenantId, tenant inactive, or not configured):
 *    use owner SMTP from env (SMTP_HOST, SMTP_USER, SMTP_PASS, etc.).
 */
async function resolveSmtpConfig(
  tenantId?: number | null,
): Promise<SmtpConfig> {
  // Start with owner SMTP from env; override with academy SMTP when available
  let host = process.env.SMTP_HOST;
  let port = Number(process.env.SMTP_PORT) || 465;
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let defaultSenderEmail = process.env.SMTP_FROM || user;
  let defaultSenderName = process.env.SMTP_SENDER || BRAND_NAME;

  let usedTenantSmtp = false;
  let tenant: {
    academyName: string;
    awsHost: string | null;
    awsPort: number | null;
    awsUsername: string | null;
    awsPassword: string | null;
    awsSMTPSecure: string | null;
    primaryEmail: string;
  } | null = null;

  if (tenantId) {
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        isActive: true,
        academyName: true,
        awsHost: true,
        awsPort: true,
        awsUsername: true,
        awsPassword: true,
        awsSMTPSecure: true,
        primaryEmail: true,
      },
    });
    // Use academy SMTP only when tenant is active and has SMTP configured; else fall back to owner env
    tenant =
      tenantRow && tenantRow.isActive
        ? (tenantRow as {
            academyName: string;
            awsHost: string | null;
            awsPort: number | null;
            awsUsername: string | null;
            awsPassword: string | null;
            awsSMTPSecure: string | null;
            primaryEmail: string;
          })
        : null;

    usedTenantSmtp =
      !!(tenant?.awsHost && tenant?.awsUsername && tenant?.awsPassword);
    if (usedTenantSmtp) {
      // Academy SMTP from DB table – use it
      host = tenant!.awsHost!;
      port = tenant!.awsPort || 465;
      user = tenant!.awsUsername!;
      pass = tenant!.awsPassword!;
      defaultSenderEmail = tenant!.primaryEmail || process.env.SMTP_FROM || user;
      defaultSenderName = tenant!.academyName || BRAND_NAME;

      console.log('Using academy SMTP from DB table:', {
        tenantId,
        host,
        port,
        hasUser: !!user,
        hasPass: !!pass,
        senderEmail: defaultSenderEmail,
        senderName: defaultSenderName,
      });
    } else if (tenantId) {
      console.log(
        'Academy has no SMTP configured in DB, using owner SMTP from .env',
        { tenantId },
      );
    }
  }

  // Determine secure and requireTLS based on tenant's awsSMTPSecure, SMTP_SECURE env var, or port
  let secure = false;
  let requireTLS = false;
  
  // Use tenant setting if available, otherwise use env var
  const secureSetting = tenant?.awsSMTPSecure || process.env.SMTP_SECURE;
  
  if (secureSetting) {
    const secureValue = String(secureSetting).toLowerCase();
    if (secureValue === 'tls' || secureValue === 'starttls') {
      secure = false;
      requireTLS = true;
    } else if (secureValue === 'ssl' || secureValue === 'true' || secureValue === '1' || secureValue === 'yes') {
      secure = true;
      requireTLS = false;
    } else if (secureValue === 'false' || secureValue === '0' || secureValue === 'no') {
      secure = false;
      requireTLS = false;
    }
  } else {
    // Default behavior based on port
    if (port === 465) {
      secure = true; // Port 465 typically uses SSL
      requireTLS = false;
    } else if (port === 587) {
      secure = false; // Port 587 typically uses STARTTLS
      requireTLS = true;
    } else {
      // For other ports, default to secure=false
      secure = false;
      requireTLS = false;
    }
  }

  // When academy SMTP not used, host/user/pass are from owner .env
  console.log('Using SMTP config:', {
    hasHost: !!host,
    hasUser: !!user,
    hasPass: !!pass,
    hasSenderEmail: !!defaultSenderEmail,
    port,
    secure,
    requireTLS,
    tenantId: tenantId ?? 'none',
    smtpSecure: process.env.SMTP_SECURE,
  });

  if (!host || !user || !pass || !defaultSenderEmail) {
    const missing = [];
    if (!host) missing.push('SMTP_HOST');
    if (!user) missing.push('SMTP_USER');
    if (!pass) missing.push('SMTP_PASS');
    if (!defaultSenderEmail) missing.push('SMTP_FROM or SMTP_USER');
    throw new Error(`SMTP configuration is incomplete. Missing: ${missing.join(', ')}`);
  }

  // Warn about port 25 which is often blocked
  if (port === 25) {
    console.warn(
      'Warning: Using port 25, which is often blocked by ISPs and cloud providers. Consider using port 587 (STARTTLS) or 465 (SSL).',
    );
  }

  // Sender: academy primary email when using academy SMTP, else owner env
  const senderEmail = defaultSenderEmail;
  let senderName = defaultSenderName;

  if (tenant && tenant.academyName) {
    // Use tenant's academy name for sender name when using tenant SMTP
    senderName = tenant.academyName;
  }

  return {
    transport: {
      host,
      port,
      secure,
      requireTLS,
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
      auth: { user, pass },
    },
    senderEmail,
    senderName,
    usedTenantSmtp: tenantId ? usedTenantSmtp : false,
  };
}
