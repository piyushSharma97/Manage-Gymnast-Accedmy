import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, UserStatus } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { EmailTemplateType, sendEmail } from '@/services/send-email';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch all tenants
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const subscriptionStatus = searchParams.get('subscriptionStatus');
  const skip = (page - 1) * limit;

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    // Sync DB: set isActive=false for academies whose subscription has expired
    const now = new Date();
    await prisma.tenant.updateMany({
      where: {
        subscriptionEndDate: { lt: now },
        isActive: true,
      },
      data: { isActive: false },
    });

    const whereClause: any = {
      AND: [
        {
          OR: [
            {
              academyName: {
                contains: query,
              },
            },
            {
              academyCode: {
                contains: query,
              },
            },
            {
              primaryEmail: {
                contains: query,
              },
            },
            {
              city: {
                contains: query,
              },
            },
          ],
        },
      ],
    };

    if (isActive === 'true' || isActive === 'false') {
      whereClause.AND.push({ isActive: isActive === 'true' });
    }

    if (subscriptionStatus) {
      whereClause.AND.push({ subscriptionStatus });
    }

    // Count total records matching the filter
    const total = await prisma.tenant.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.tenant.count();
      isTableEmpty = overallTotal === 0;
    }

    const tenants =
      total > 0
        ? await prisma.tenant.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
            include: {
              subscriptionPlan: {
                select: {
                  id: true,
                  planName: true,
                },
              },
            },
          })
        : [];

    return NextResponse.json({
      data: tenants,
      pagination: {
        total,
        page,
      },
      empty: isTableEmpty,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new tenant (owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    if ((session.user as { roleSlug?: string })?.roleSlug !== 'owner') {
      return NextResponse.json(
        { message: 'Only owners can add an academy.' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

    const academyName = typeof body?.academyName === 'string' ? body.academyName.trim() : '';
    const academyCode = typeof body?.academyCode === 'string' ? body.academyCode.trim() : '';
    const businessRegistrationNumber =  '';
    const taxId = '';
    const website = typeof body?.website === 'string' ? body.website.trim() : null;
    const logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : null;
    const primaryEmail = typeof body?.primaryEmail === 'string' ? body.primaryEmail.trim() : '';
    const primaryPhone = typeof body?.primaryPhone === 'string' ? body.primaryPhone.trim() : '';
    const addressLine1 = typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : '';
    const addressLine2 = typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : null;
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const state = typeof body?.state === 'string' ? body.state.trim() : '';
    const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim() : '';
    const country =  '';
    const timeZone = 'UTC';
    const subscriptionPlanId = typeof body?.subscriptionPlanId === 'number' ? body.subscriptionPlanId : null;
    const subscriptionStatus = typeof body?.subscriptionStatus === 'string' ? body.subscriptionStatus : 'trial';
    // Handle date fields with proper validation
    const subscriptionStartDate = body?.subscriptionStartDate && body.subscriptionStartDate.trim() !== '' 
      ? new Date(body.subscriptionStartDate) 
      : new Date();
    
      const subscriptionEndDate =
      body?.subscriptionEndDate && body.subscriptionEndDate.trim() !== ''
        ? new Date(body.subscriptionEndDate)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
    const awsSMTPSecure =
      typeof body?.awsSMTPSecure === 'string' ? body.awsSMTPSecure.trim() || null : null;
    const awsHost =
      typeof body?.awsHost === 'string' ? body.awsHost.trim() || null : null;
    const awsPort =
      typeof body?.awsPort === 'number'
        ? body.awsPort
        : typeof body?.awsPort === 'string' && body.awsPort.trim() !== ''
          ? Number(body.awsPort)
          : null;
    const awsUsername =
      typeof body?.awsUsername === 'string'
        ? body.awsUsername.trim() || null
        : null;
    const awsPassword =
      typeof body?.awsPassword === 'string'
        ? body.awsPassword.trim() || null
        : null;

    if (awsPort !== null && (isNaN(awsPort) || awsPort <= 0)) {
      return NextResponse.json(
        { message: 'Invalid AWS SMTP port value' },
        { status: 400 },
      );
    }

    const hasAwsConfig =
      awsHost !== null ||
      awsPort !== null ||
      awsUsername !== null ||
      awsPassword !== null;

    if (
      hasAwsConfig &&
      (!awsHost || !awsPort || !awsUsername || !awsPassword)
    ) {
      return NextResponse.json(
        {
          message:
            'Complete AWS SMTP credentials (host, port, username, password) are required when configuring email.',
        },
        { status: 400 },
      );
    }

    // Validate dates
    if (isNaN(subscriptionStartDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid subscription start date' },
        { status: 400 },
      );
    }

    if (isNaN(subscriptionEndDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid subscription end date' },
        { status: 400 },
      );
    }
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    if (!academyName || academyName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid academy name' },
        { status: 400 },
      );
    }

    if (!academyCode || academyCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid academy code' },
        { status: 400 },
      );
    }

    if (!primaryEmail || primaryEmail.length > 100) {
      return NextResponse.json(
        { message: 'Invalid primary email' },
        { status: 400 },
      );
    }

    if (!primaryPhone || primaryPhone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid primary phone' },
        { status: 400 },
      );
    }

    if (!addressLine1 || addressLine1.length > 255) {
      return NextResponse.json(
        { message: 'Invalid address line 1' },
        { status: 400 },
      );
    }

    if (!city || city.length > 100) {
      return NextResponse.json(
        { message: 'Invalid city' },
        { status: 400 },
      );
    }

    if (!state || state.length > 100) {
      return NextResponse.json(
        { message: 'Invalid state' },
        { status: 400 },
      );
    }

    if (!postalCode || postalCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid postal code' },
        { status: 400 },
      );
    }

    

    if (!subscriptionPlanId || subscriptionPlanId <= 0) {
      return NextResponse.json(
        { message: 'Invalid subscription plan ID' },
        { status: 400 },
      );
    }

    // Verify subscription plan exists
    const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: subscriptionPlanId },
    });

    if (!subscriptionPlan) {
      return NextResponse.json(
        { message: 'Subscription plan not found' },
        { status: 400 },
      );
    }

    // Ensure the academy code is unique
    const uniqueCode = await isUnique('tenant', { academyCode });
    if (!uniqueCode) {
      return NextResponse.json(
        { message: 'Academy code must be unique' },
        { status: 400 },
      );
    }

    // Ensure the primary email is unique
    const uniqueEmail = await isUnique('tenant', { primaryEmail });
    if (!uniqueEmail) {
      return NextResponse.json(
        { message: 'Primary email must be unique' },
        { status: 400 },
      );
    }

    const { tenant: newTenant, user: tenantAdminUser } =
      await prisma.$transaction(async (tx) => {
      // 1) Create tenant with optional AWS email credentials
      const tenantCreateData = {
        academyName,
        academyCode,
        businessRegistrationNumber,
        taxId,
        website,
        logoUrl,
        primaryEmail,
        primaryPhone,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        timeZone,
        subscriptionPlanId,
        subscriptionStatus,
        subscriptionStartDate,
        subscriptionEndDate,
        isActive,
        awsSMTPSecure,
        awsHost,
        awsPort,
        awsUsername,
        awsPassword,
      } as Prisma.TenantUncheckedCreateInput;

      const createdTenant = await tx.tenant.create({
        data: tenantCreateData,
      });

      // 2) Create the tenant's primary user with roleId = 2
      const createdUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          roleId: 2,
          email: primaryEmail,
          name: academyName,
          status: UserStatus.ACTIVE,
          createdBy: session.user.id,
        },
      });

      // 3) Update tenant.userId to the created user's id
      const updatedTenant = await tx.tenant.update({
        where: { id: createdTenant.id },
        data: { userId: createdUser.id },
      });

      return { tenant: updatedTenant, user: createdUser };
    });

    const passwordSetupToken = crypto.randomBytes(48).toString('hex');
    const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.verificationToken.create({
      data: {
        identifier: tenantAdminUser.id,
        token: passwordSetupToken,
        expires: passwordSetupExpiry,
      },
    });

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${passwordSetupToken}`;

    // Send welcome email from platform SMTP (env) to academy admin, with "Regards, My Academy Team"
    try {
      await sendEmail({
        to: tenantAdminUser.email,
        usePlatformSmtp: true,
        template: {
          type: EmailTemplateType.WELCOME_TENANT,
          data: {
            academyName: newTenant.academyName,
            passwordSetupUrl,
            supportEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'support@myacademy.com',
          },
        },
      });
      console.log(`Welcome email sent successfully to ${tenantAdminUser.email} for tenant ${newTenant.id}`);
    } catch (emailError: any) {
      // Log error but don't fail tenant creation
      console.error(`Failed to send welcome email to ${tenantAdminUser.email}:`, emailError);
      console.error('Tenant created successfully but email notification failed:', {
        tenantId: newTenant.id,
        email: tenantAdminUser.email,
        error: emailError?.message,
      });
    }

    await systemLog({
      event: 'create',
      userId: session.user.id,
      entityId: String(newTenant.id),
      entityType: 'tenant',
      description: 'Academy added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newTenant);
  } catch (error: any) {
    console.error('API Error:', error);
    // Handle unique constraint violation for user email
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'A user with this email already exists.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
