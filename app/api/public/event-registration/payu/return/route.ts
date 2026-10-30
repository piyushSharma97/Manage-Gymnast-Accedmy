import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { payuVerifyResponseHash } from '@/lib/payu';
import { resolvePayuCredentials } from '@/lib/public-external-event';
import { getExternalRegistrationOutcomeUrl } from '@/lib/external-event-registration-url';
import { sendEmail } from '@/services/send-email';

function redirectHtml(url: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}"></head><body><p>Redirecting… <a href="${url}">Continue</a></p></body></html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  );
}

export async function POST(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    `${new URL(request.url).protocol}//${new URL(request.url).host}`;

  try {
    const form = await request.formData();
    const status = String(form.get('status') || '');
    const txnid = String(form.get('txnid') || '');
    const amount = String(form.get('amount') || '');
    const productinfo = String(form.get('productinfo') || '');
    const firstname = String(form.get('firstname') || '');
    const email = String(form.get('email') || '');
    const hash = String(form.get('hash') || '');
    const key = String(form.get('key') || '');
    const mihpayid = String(form.get('mihpayid') || '');
    const udf1 = String(form.get('udf1') || '');
    const udf2 = String(form.get('udf2') || '');
    const udf3 = String(form.get('udf3') || '');
    const udf4 = String(form.get('udf4') || '');
    const udf5 = String(form.get('udf5') || '');

    const feeId = parseInt(udf1, 10);
    if (!Number.isFinite(feeId)) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'invalid' }));
    }

    const feeRow = await prisma.studentEventFee.findUnique({
      where: { id: feeId },
      include: {
        student: true,
        event: true,
      },
    });

    if (!feeRow || !feeRow.student) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'notfound' }));
    }

    const tenant = (await prisma.tenant.findUnique({
      where: { id: feeRow.student.tenantId },
      select: {
        id: true,
        academyName: true,
        payuMerchantKey: true,
        payuMerchantSalt: true,
        primaryEmail: true,
      } as any,
    })) as {
      id: number;
      academyName: string;
      payuMerchantKey: string | null;
      payuMerchantSalt: string | null;
      primaryEmail: string;
    } | null;

    if (!tenant) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'tenant' }));
    }

    const payu = resolvePayuCredentials(tenant);
    if (!payu || payu.key !== key) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'config' }));
    }

    const okHash = payuVerifyResponseHash({
      salt: payu.salt,
      status,
      email,
      firstname,
      productinfo,
      amount,
      txnid,
      key: payu.key,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      receivedHash: hash,
    });

    if (!okHash) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'hash' }));
    }

    const expected = Number(feeRow.Total).toFixed(2);
    if (amount !== expected) {
      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'amount' }));
    }

    if (status === 'success') {
      await prisma.studentEventFee.update({
        where: { id: feeRow.id },
        data: {
          Status: 1,
          PaymentMode: 'PayU',
          Comments: `payu_mihpayid:${mihpayid} txnid:${txnid}`,
          updatedAt: new Date(),
          updatedBy: 'payu-callback',
        },
      });

      const parentEmail = feeRow.student.email;
      if (parentEmail) {
        try {
          await sendEmail({
            to: parentEmail,
            subject: `Registration confirmed — ${feeRow.event?.name || 'Event'}`,
            text:
              `Hello,\n\nYour registration for "${feeRow.event?.name || 'the event'}" at ${tenant.academyName} is confirmed.\n` +
              `Amount paid: ₹${amount}\n` +
              (mihpayid ? `Payment reference: ${mihpayid}\n` : '') +
              `\nThank you.`,
            tenantId: tenant.id,
          });
        } catch (err) {
          console.error('external registration confirmation email:', err);
        }
      }

      return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'success'));
    }

    await prisma.studentEventFee.update({
      where: { id: feeRow.id },
      data: {
        Comments: `payu_failed:${status} txnid:${txnid}`,
        updatedAt: new Date(),
        updatedBy: 'payu-callback',
      },
    });

    return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'payment' }));
  } catch (e) {
    console.error('payu return:', e);
    return redirectHtml(getExternalRegistrationOutcomeUrl(origin, 'failure', { reason: 'error' }));
  }
}
