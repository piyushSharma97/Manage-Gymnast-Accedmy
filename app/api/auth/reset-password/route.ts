import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyRecaptchaToken } from '@/lib/recaptcha';
import { EmailTemplateType, sendEmail } from '@/services/send-email';

export async function POST(req: NextRequest) {
  try {
    const recaptchaToken = req.headers.get('x-recaptcha-token');

    if (!recaptchaToken) {
      return NextResponse.json(
        { message: 'Please complete the reCAPTCHA verification.' },
        { status: 400 },
      );
    }

    const isValidToken = await verifyRecaptchaToken(recaptchaToken);

    if (!isValidToken) {
      return NextResponse.json(
        { message: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 },
      );
    }

    const { email } = await req.json();

    // Check if the user exists and get role for parent/guardian tenant resolution
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: { select: { slug: true } },
      },
    });

    if (!user) {
      // Don't reveal that the email doesn't exist
      return NextResponse.json(
        {
          message:
            'If an account with that email exists, a password reset link has been sent.',
        },
        { status: 200 },
      );
    }

    // Resolve tenantId: use user.tenantId or academy from Guardian (parent/guardian)
    // sendEmail uses academy SMTP when academy is active and configured, else owner SMTP
    let tenantIdForEmail = user.tenantId ?? undefined;
    if (
      !tenantIdForEmail &&
      (user.role.slug === 'parent' || user.role.slug === 'guardian')
    ) {
      const guardian = await prisma.guardian.findFirst({
        where: { userId: user.id },
        select: { tenantId: true },
      });
      if (guardian?.tenantId) tenantIdForEmail = guardian.tenantId;
    }

    // Generate a secure reset token
    const token = crypto.randomBytes(32).toString('hex');

    // Delete any existing reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: { identifier: user.id },
    });

    // Store the token in the database with an expiry of 1 hour
    await prisma.verificationToken.create({
      data: {
        identifier: user.id,
        token,
        expires: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour expiry
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/change-password?token=${token}`;

    // Send password reset email: academy SMTP if academy connected, else owner SMTP
    await sendEmail({
      to: email,
      tenantId: tenantIdForEmail,
      template: {
        type: EmailTemplateType.PASSWORD_RESET,
        data: {
          recipientName: user.name || 'there',
          resetUrl,
        },
      },
    });

    return NextResponse.json(
      {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error('Password reset error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to process request.';
    return NextResponse.json(
      {
        message:
          process.env.NODE_ENV === 'development'
            ? message
            : 'Failed to process request.',
      },
      { status: 500 },
    );
  }
}
