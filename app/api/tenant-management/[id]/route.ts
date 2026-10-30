import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch a specific tenant by ID
export async function GET(
  request: Request,
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

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid tenant ID' },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptionPlan: {
          select: {
            id: true,
            planName: true,
            description: true,
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { message: 'Tenant not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(tenant);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific tenant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { id: idParam } = await params;
    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid tenant ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const academyName = typeof body?.academyName === 'string' ? body.academyName.trim() : '';
    const academyCode = typeof body?.academyCode === 'string' ? body.academyCode.trim() : '';
    const businessRegistrationNumber ='';
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
    const country = 'India';
    const timeZone = 'UTC';
    const subscriptionPlanId = typeof body?.subscriptionPlanId === 'number' ? body.subscriptionPlanId : null;
    const subscriptionStatus = typeof body?.subscriptionStatus === 'string' ? body.subscriptionStatus : null;
    // Handle date fields with proper validation
    const subscriptionStartDate = body?.subscriptionStartDate && body.subscriptionStartDate.trim() !== '' 
      ? new Date(body.subscriptionStartDate) 
      : null;
    
    const subscriptionEndDate = body?.subscriptionEndDate && body.subscriptionEndDate.trim() !== ''
      ? new Date(body.subscriptionEndDate)
      : null;

    const awsSMTPSecure =
      'awsSMTPSecure' in body
        ? typeof body.awsSMTPSecure === 'string'
          ? body.awsSMTPSecure.trim() || null
          : null
        : undefined;
    const awsHost =
      'awsHost' in body
        ? typeof body.awsHost === 'string'
          ? body.awsHost.trim() || null
          : null
        : undefined;
    const awsPort =
      'awsPort' in body
        ? typeof body.awsPort === 'number'
          ? body.awsPort
          : typeof body.awsPort === 'string' && body.awsPort.trim() !== ''
            ? Number(body.awsPort)
            : null
        : undefined;
    const awsUsername =
      'awsUsername' in body
        ? typeof body.awsUsername === 'string'
          ? body.awsUsername.trim() || null
          : null
        : undefined;
    const awsPassword =
      'awsPassword' in body
        ? typeof body.awsPassword === 'string'
          ? body.awsPassword.trim() || null
          : null
        : undefined;

    // Validate dates if provided
    if (subscriptionStartDate && isNaN(subscriptionStartDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid subscription start date' },
        { status: 400 },
      );
    }

    if (subscriptionEndDate && isNaN(subscriptionEndDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid subscription end date' },
        { status: 400 },
      );
    }
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;

    if (
      awsPort !== undefined &&
      awsPort !== null &&
      (isNaN(awsPort) || awsPort <= 0)
    ) {
      return NextResponse.json(
        { message: 'Invalid AWS SMTP port value' },
        { status: 400 },
      );
    }

    const awsFieldsProvided = [awsHost, awsPort, awsUsername, awsPassword].some(
      (value) => value !== undefined,
    );

    if (awsFieldsProvided) {
      const isClearing =
        awsHost === null &&
        awsPort === null &&
        awsUsername === null &&
        awsPassword === null;

      const hasCompleteCredentials =
        awsHost !== undefined &&
        awsHost !== null &&
        awsPort !== undefined &&
        awsPort !== null &&
        awsUsername !== undefined &&
        awsUsername !== null &&
        awsPassword !== undefined &&
        awsPassword !== null;

      if (!isClearing && !hasCompleteCredentials) {
        return NextResponse.json(
          {
            message:
              'Complete AWS SMTP credentials (host, port, username, password) are required when updating email settings.',
          },
          { status: 400 },
        );
      }
    }

    // Check if tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { message: 'Tenant not found' },
        { status: 404 },
      );
    }

    if (academyName && academyName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid academy name' },
        { status: 400 },
      );
    }

    if (academyCode && academyCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid academy code' },
        { status: 400 },
      );
    }

    if (primaryEmail && primaryEmail.length > 100) {
      return NextResponse.json(
        { message: 'Invalid primary email' },
        { status: 400 },
      );
    }

    if (primaryPhone && primaryPhone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid primary phone' },
        { status: 400 },
      );
    }

    if (addressLine1 && addressLine1.length > 255) {
      return NextResponse.json(
        { message: 'Invalid address line 1' },
        { status: 400 },
      );
    }

    if (city && city.length > 100) {
      return NextResponse.json(
        { message: 'Invalid city' },
        { status: 400 },
      );
    }

    if (state && state.length > 100) {
      return NextResponse.json(
        { message: 'Invalid state' },
        { status: 400 },
      );
    }

    if (postalCode && postalCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid postal code' },
        { status: 400 },
      );
    }

    if (country && country.length > 100) {
      return NextResponse.json(
        { message: 'Invalid country' },
        { status: 400 },
      );
    }

    // If subscriptionPlanId is provided, verify subscription plan exists
    if (subscriptionPlanId) {
      const subscriptionPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: subscriptionPlanId },
      });

      if (!subscriptionPlan) {
        return NextResponse.json(
          { message: 'Subscription plan not found' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for academy code if provided and different from current
    if (academyCode && academyCode !== existingTenant.academyCode) {
      const uniqueCode = await isUnique('tenant', { academyCode });
      if (!uniqueCode) {
        return NextResponse.json(
          { message: 'Academy code must be unique' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for primary email if provided and different from current
    if (primaryEmail && primaryEmail !== existingTenant.primaryEmail) {
      const uniqueEmail = await isUnique('tenant', { primaryEmail });
      if (!uniqueEmail) {
        return NextResponse.json(
          { message: 'Primary email must be unique' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (academyName) updateData.academyName = academyName;
    if (academyCode) updateData.academyCode = academyCode;
    if (businessRegistrationNumber !== undefined) updateData.businessRegistrationNumber = businessRegistrationNumber;
    if (taxId !== undefined) updateData.taxId = taxId;
    if (website !== undefined) updateData.website = website;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (primaryEmail) updateData.primaryEmail = primaryEmail;
    if (primaryPhone) updateData.primaryPhone = primaryPhone;
    if (addressLine1) updateData.addressLine1 = addressLine1;
    if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (postalCode) updateData.postalCode = postalCode;
    if (country) updateData.country = country;
    if (timeZone) updateData.timeZone = timeZone;
    if (subscriptionPlanId) updateData.subscriptionPlanId = subscriptionPlanId;
    if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
    if (subscriptionStartDate) updateData.subscriptionStartDate = subscriptionStartDate;
    if (subscriptionEndDate) updateData.subscriptionEndDate = subscriptionEndDate;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (awsSMTPSecure !== undefined) updateData.awsSMTPSecure = awsSMTPSecure;
    if (awsHost !== undefined) updateData.awsHost = awsHost;
    if (awsPort !== undefined) updateData.awsPort = awsPort;
    if (awsUsername !== undefined) updateData.awsUsername = awsUsername;
    if (awsPassword !== undefined) updateData.awsPassword = awsPassword;

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
      include: {
        subscriptionPlan: {
          select: {
            id: true,
            planName: true,
            description: true,
          },
        },
      },
    });

    await systemLog({
      event: 'update',
      userId: session.user.id,
      entityId: String(updatedTenant.id),
      entityType: 'tenant',
      description: 'Tenant updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedTenant);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific tenant
export async function DELETE(
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

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid tenant ID' },
        { status: 400 },
      );
    }

    // Check if tenant exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { message: 'Tenant not found' },
        { status: 404 },
      );
    }

    // Check if tenant has associated users
    const usersCount = await prisma.user.count({
      where: { tenantId: id },
    });

    if (usersCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenant that has associated users' },
        { status: 400 },
      );
    }

    // Check if tenant has associated students
    const studentsCount = await prisma.student.count({
      where: { tenantId: id },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenant that has associated students' },
        { status: 400 },
      );
    }

    // Check if tenant has associated locations
    const locationsCount = await prisma.location.count({
      where: { tenantId: id },
    });

    if (locationsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenant that has associated locations' },
        { status: 400 },
      );
    }

    await prisma.tenant.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: session.user.id,
      entityId: String(id),
      entityType: 'tenant',
      description: 'Tenant deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Tenant deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
