import { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/services/send-email';

/**
 * Resolves the best parent/guardian email for a student.
 * Priority: primary guardian email > student email > emergency contact email.
 */
export async function getParentEmailForStudent(
  prisma: PrismaClient,
  studentId: bigint,
  tenantId: number
): Promise<string | null> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    select: {
      email: true,
      emergencyContactEmail: true,
      studentguardians: {
        where: { guardian: { email: { not: null } } },
        orderBy: { isPrimary: 'desc' },
        take: 1,
        select: {
          guardian: {
            select: { email: true },
          },
        },
      },
    },
  });

  if (!student) return null;

  const guardianEmail = student.studentguardians[0]?.guardian?.email?.trim();
  if (guardianEmail) return guardianEmail;

  const studentEmail = student.email?.trim();
  if (studentEmail) return studentEmail;

  const emergencyEmail = student.emergencyContactEmail?.trim();
  if (emergencyEmail) return emergencyEmail;

  return null;
}

export interface InvoiceGeneratedEmailParams {
  to: string;
  tenantId: number;
  academyName: string;
  studentName: string;
  invoiceNo: string;
  amount: number | null;
  dueDate: Date | null;
  billingMonth?: Date;
}

/**
 * Sends an email to the parent when an invoice is generated.
 * Uses academy SMTP if configured, else owner SMTP.
 * Includes academy name and logo when available.
 * Does not throw; caller should catch and log.
 */
export async function sendInvoiceGeneratedEmail(
  params: InvoiceGeneratedEmailParams
): Promise<void> {
  const {
    to,
    tenantId,
    academyName,
    studentName,
    invoiceNo,
    amount,
    dueDate,
    billingMonth,
  } = params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true },
  });

  const amountText =
    amount !== null ? formatCurrency(amount) : 'As per your fee plan';
  const dueText =
    dueDate !== null
      ? dueDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '–';
  const billingText = billingMonth
    ? billingMonth.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '';

  const invoiceRows = [
    `<tr><td style="padding:8px 0;color:#6b7280;width:40%;">Invoice No</td><td style="padding:8px 0;font-weight:600;">${invoiceNo}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#6b7280;">Student</td><td style="padding:8px 0;">${studentName}</td></tr>`,
    amount !== null
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Amount Due</td><td style="padding:8px 0;font-weight:600;color:#111827;">${amountText}</td></tr>`
      : '',
    `<tr><td style="padding:8px 0;color:#6b7280;">Due Date</td><td style="padding:8px 0;">${dueText}</td></tr>`,
    billingText
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Billing Period</td><td style="padding:8px 0;">${billingText}</td></tr>`
      : '',
  ].filter(Boolean);

  const description =
    '<p style="margin:0 0 16px;">Dear Parent/Guardian,</p>' +
    '<p style="margin:0 0 16px;">A new invoice has been generated for ' +
    studentName +
    '.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">' +
    invoiceRows.join('') +
    '</table>' +
    '<p style="margin:0;">Please ensure timely payment. For any queries, contact ' +
    academyName +
    '.</p>';

  await sendEmail({
    to,
    tenantId,
    subject: `Invoice ${invoiceNo} – ${academyName}`,
    content: {
      title: 'New Invoice Generated',
      subtitle: `Invoice ${invoiceNo} for ${studentName}`,
      description,
      signatureName: academyName,
      logoUrl: tenant?.logoUrl ?? null,
      headerName: academyName,
    },
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

export interface PaymentReceiptEmailParams {
  to: string;
  tenantId: number;
  academyName: string;
  studentName: string;
  invoiceNo: string | null;
  orderId: string | null;
  amountPaid: number;
  paymentMode: string;
  receivedAt: Date;
  courseName?: string | null;
  locationName?: string;
}

/**
 * Sends payment receipt email to parent/guardian.
 * Uses academy SMTP if configured, else owner SMTP.
 * Does not throw; caller should catch and log.
 */
export async function sendPaymentReceiptEmail(
  params: PaymentReceiptEmailParams
): Promise<void> {
  const {
    to,
    tenantId,
    academyName,
    studentName,
    invoiceNo,
    orderId,
    amountPaid,
    paymentMode,
    receivedAt,
    courseName,
    locationName,
  } = params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true },
  });

  const receivedDate = receivedAt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const rows = [
    `<tr><td style="padding:8px 0;color:#6b7280;width:40%;">Student</td><td style="padding:8px 0;font-weight:600;">${studentName}</td></tr>`,
    amountPaid > 0
      ? `<tr><td style="padding:8px 0;color:#6b7280;">Amount Paid</td><td style="padding:8px 0;font-weight:600;color:#111827;">${formatCurrency(amountPaid)}</td></tr>`
      : '',
    paymentMode ? `<tr><td style="padding:8px 0;color:#6b7280;">Payment Mode</td><td style="padding:8px 0;">${paymentMode}</td></tr>` : '',
    orderId ? `<tr><td style="padding:8px 0;color:#6b7280;">Order ID</td><td style="padding:8px 0;">${orderId}</td></tr>` : '',
    invoiceNo ? `<tr><td style="padding:8px 0;color:#6b7280;">Invoice No</td><td style="padding:8px 0;">${invoiceNo}</td></tr>` : '',
    courseName ? `<tr><td style="padding:8px 0;color:#6b7280;">Course</td><td style="padding:8px 0;">${courseName}</td></tr>` : '',
    locationName ? `<tr><td style="padding:8px 0;color:#6b7280;">Location</td><td style="padding:8px 0;">${locationName}</td></tr>` : '',
    `<tr><td style="padding:8px 0;color:#6b7280;">Date & Time</td><td style="padding:8px 0;">${receivedDate}</td></tr>`,
  ].filter(Boolean);

  const description =
    '<p style="margin:0 0 16px;">Dear Parent/Guardian,</p>' +
    '<p style="margin:0 0 16px;">Thank you for your payment. Please find the receipt details below:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px;">' +
    rows.join('') +
    '</table>' +
    '<p style="margin:0;">For any queries, contact ' + academyName + '.</p>';

  await sendEmail({
    to,
    tenantId,
    subject: `Payment Receipt – ${academyName}`,
    content: {
      title: 'Payment Receipt',
      subtitle: `Receipt for ${studentName}`,
      description,
      signatureName: academyName,
      logoUrl: tenant?.logoUrl ?? null,
      headerName: academyName,
    },
  });
}
