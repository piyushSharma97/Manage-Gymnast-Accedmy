import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { EmailTemplateType, sendEmail } from '@/services/send-email';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

     if ((session.user as { roleSlug?: string })?.roleSlug !== 'owner') {
      return NextResponse.json(
        { message: 'Only owners can send the welcome email.' },
        { status: 403 },
      );
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid tenant ID' },
        { status: 400 },
      );
    }

    // Fetch tenant with user
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          where: {
            roleId: 2, // Primary admin user
          },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { message: 'Tenant not found' },
        { status: 404 },
      );
    }

    const tenantAdminUser = tenant.users[0];
    if (!tenantAdminUser) {
      return NextResponse.json(
        { message: 'Tenant admin user not found' },
        { status: 404 },
      );
    }

    // Generate a new password setup token
    const passwordSetupToken = crypto.randomBytes(48).toString('hex');
    const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Delete any existing tokens for this user
    await prisma.verificationToken.deleteMany({
      where: { identifier: tenantAdminUser.id },
    });

    // Create new token
    await prisma.verificationToken.create({
      data: {
        identifier: tenantAdminUser.id,
        token: passwordSetupToken,
        expires: passwordSetupExpiry,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${passwordSetupToken}`;
  const adminEmail='abx@example.com'
    // Send welcome email from platform SMTP (env), with "Regards, My Academy Team"
    try {
      await sendEmail({
        to: adminEmail,
        usePlatformSmtp: true,
        template: {
          type: EmailTemplateType.WELCOME_TENANT,
          data: {
            academyName: tenant.academyName,
            passwordSetupUrl,
            supportEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'support@myacademy.com',
          },
        },
      });

      return NextResponse.json({
        message: 'Welcome email sent successfully',
      });
    } catch (emailError: any) {
      console.error(`Failed to send welcome email to ${tenantAdminUser.email}:`, emailError);
      return NextResponse.json(
        {
          message: `Failed to send email: ${emailError?.message || 'Unknown error'}`,
        },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

