import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { EXTERNAL_EVENT_TYPE, isExternalEventType } from '@/lib/event-external';
import { payuPaymentBaseUrl, payuRequestHash } from '@/lib/payu';
import {
  isEventRegistrationOpen,
  resolvePayuCredentials,
  resolveTenantForPublicRegistration,
  splitFullName,
} from '@/lib/public-external-event';
import { verifyRecaptchaToken } from '@/lib/recaptcha';

const CREATED_BY_EXTERNAL = 'external-event-registration';

function appOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (env) return env;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(request: NextRequest) {
  try {
    const recaptchaToken = request.headers.get('x-recaptcha-token')?.trim() ?? '';
    if (!recaptchaToken) {
      return NextResponse.json(
        { message: 'Please complete the reCAPTCHA verification.' },
        { status: 400 },
      );
    }
    const recaptchaOk = await verifyRecaptchaToken(recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json(
        { message: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 },
      );
    }

    const tenant = await resolveTenantForPublicRegistration(request);
    if (!tenant) {
      return NextResponse.json(
        { message: 'Invalid or missing academy. Use your academy registration link.' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const studentName = typeof body?.studentName === 'string' ? body.studentName.trim() : '';
    const parentName = typeof body?.parentName === 'string' ? body.parentName.trim() : '';
    const dobRaw = typeof body?.dob === 'string' ? body.dob.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const eventId =
      typeof body?.eventId === 'number' ? body.eventId : parseInt(String(body?.eventId || ''), 10);

    if (!studentName || !parentName || !dobRaw || !phone || !email || !email.includes('@')) {
      return NextResponse.json({ message: 'Please fill all required fields with a valid email.' }, { status: 400 });
    }
    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ message: 'Please select an event.' }, { status: 400 });
    }

    const dob = new Date(dobRaw);
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ message: 'Invalid date of birth.' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId: tenant.id },
    });

    if (!event || !isExternalEventType(event.event_type)) {
      return NextResponse.json({ message: 'Event is not available for public registration.' }, { status: 404 });
    }

    if (!isEventRegistrationOpen(event)) {
      return NextResponse.json({ message: 'Registration is not open for this event.' }, { status: 400 });
    }

    const dup = await prisma.studentEventFee.findFirst({
      where: {
        eventid: eventId,
        student: { tenantId: tenant.id, email },
      },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { message: 'This email is already registered for the selected event.' },
        { status: 400 },
      );
    }

    const gymnastics = await prisma.sportsCategory.findFirst({
      where: { categoryName: { equals: 'Gymnastics' } },
      select: { categoryName: true },
    });
    const sportCategoryName = gymnastics?.categoryName || 'Gymnastics';

    const { firstName: stFirst, lastName: stLast } = splitFullName(studentName);
    const { firstName: payerFirst, lastName: payerLast } = splitFullName(parentName);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const regNoPrefix = `${tenant.academyCode}-EXT-${year}-${month}-`;

    const amountNum = Number(event.fees) || 0;
    const origin = appOrigin(request);
    const surl = `${origin}/api/public/event-registration/payu/return`;
    const furl = `${origin}/api/public/event-registration/payu/return`;

    const result = await prisma.$transaction(async (tx) => {
      let sequence =
        (await tx.student.count({
          where: { tenantId: tenant.id, registrationNo: { startsWith: regNoPrefix } },
        })) + 1;
      let registrationNo = `${regNoPrefix}${sequence}`;
      while (
        await tx.student.findFirst({
          where: { tenantId: tenant.id, registrationNo },
          select: { id: true },
        })
      ) {
        sequence += 1;
        registrationNo = `${regNoPrefix}${sequence}`;
      }

      const student = await tx.student.create({
        data: {
          tenantId: tenant.id,
          locationId: event.locationId,
          registrationNo,
          firstName: stFirst,
          lastName: stLast === '-' ? null : stLast,
          email,
          phone,
          gender: 'Mixed',
          dob,
          sportCategoryName,
          country: 'India',
          emergencyContactName: parentName,
          emergencyContactPhone: phone,
          emergencyContactEmail: email,
          notes: `External event registration. Parent: ${parentName}.`,
          createdBy: CREATED_BY_EXTERNAL,
        },
      });

      const feeRow = await tx.studentEventFee.create({
        data: {
          studentId: student.id,
          eventid: eventId,
          Fees: amountNum,
          EarlyBirdDisc: null,
          SiblingDisc: null,
          Total: amountNum,
          Additional: null,
          PaymentMode: amountNum > 0 ? 'PayU' : 'External',
          Comments: null,
          Status: amountNum > 0 ? 0 : 1,
          depositdate: new Date(),
          level: null,
          eventtype: EXTERNAL_EVENT_TYPE,
          timing: event.time,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: CREATED_BY_EXTERNAL,
          updatedBy: CREATED_BY_EXTERNAL,
        },
      });

      return { student, feeRow };
    });

    if (amountNum <= 0) {
      return NextResponse.json({
        skipPayment: true,
        message: 'Registration completed. No payment required.',
      });
    }

    const payu = resolvePayuCredentials(tenant);
    if (!payu) {
      await prisma.studentEventFee.delete({ where: { id: result.feeRow.id } });
      await prisma.student.delete({ where: { id: result.student.id } });
      return NextResponse.json(
        {
          message:
            'Online payment is not configured for this academy. Please contact the academy to complete PayU setup.',
        },
        { status: 503 },
      );
    }

    const txnid = `E${result.feeRow.id}${crypto.randomBytes(3).toString('hex')}`.slice(0, 24);
    await prisma.studentEventFee.update({
      where: { id: result.feeRow.id },
      data: {
        Comments: `payu_pending:${txnid}`,
        updatedAt: new Date(),
      },
    });

    const amountStr = amountNum.toFixed(2);
    const productinfo = event.name.slice(0, 100);
    const hash = payuRequestHash({
      key: payu.key,
      salt: payu.salt,
      txnid,
      amount: amountStr,
      productinfo,
      firstname: payerFirst.slice(0, 60),
      email,
    });

    const fields: Record<string, string> = {
      key: payu.key,
      txnid,
      amount: amountStr,
      productinfo,
      firstname: payerFirst.slice(0, 60),
      lastname: (payerLast === '-' ? '-' : payerLast).slice(0, 60),
      email,
      phone,
      surl,
      furl,
      hash,
      service_provider: 'payu_paisa',
      udf1: String(result.feeRow.id),
      udf2: '',
      udf3: '',
      udf4: '',
      udf5: '',
    };

    return NextResponse.json({
      action: payuPaymentBaseUrl(),
      fields,
    });
  } catch (e: unknown) {
    console.error('public event-registration checkout:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}
