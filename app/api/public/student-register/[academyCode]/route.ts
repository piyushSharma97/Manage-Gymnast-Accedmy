import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import crypto from 'crypto';
import { sendEmail } from '@/services/send-email';
import { jsonBigInt, getErrorMessage } from '@/types/api';
import type { Gender } from '@/types/enums';
import { Prisma } from '@prisma/client';
import { findActiveTenantByAcademyCode } from '@/lib/public-external-event';
import { verifyRecaptchaToken } from '@/lib/recaptcha';

type RouteCtx = { params: Promise<{ academyCode: string }> };

export async function GET(_request: NextRequest, context: RouteCtx) {
  try {
    const { academyCode: raw } = await context.params;
    const academyCode = decodeURIComponent(raw);
    const tenant = await findActiveTenantByAcademyCode(academyCode);
    if (!tenant) {
      return NextResponse.json({ message: 'Invalid or unknown academy code.' }, { status: 404 });
    }

    const locations = await prisma.location.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, centerName: true },
      orderBy: { centerName: 'asc' },
    });

    return NextResponse.json({
      academyName: tenant.academyName,
      academyCode: tenant.academyCode,
      locations,
    });
  } catch (e: unknown) {
    console.error('GET public student-register:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteCtx) {
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

    const { academyCode: raw } = await context.params;
    const academyCodeParam = decodeURIComponent(raw);
    const tenant = await findActiveTenantByAcademyCode(academyCodeParam);
    if (!tenant) {
      return NextResponse.json({ message: 'Invalid or unknown academy code.' }, { status: 404 });
    }

    const actingUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!actingUser) {
      return NextResponse.json(
        {
          message:
            'This academy cannot accept online registrations yet. Please contact the academy directly.',
        },
        { status: 503 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const gender = typeof body?.gender === 'string' ? body.gender : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : Number(body?.locationId);
    const joinDate = body?.joinDate ? new Date(body.joinDate) : null;
    const dob = body?.dob ? new Date(body.dob) : null;
    const schoolName = typeof body?.schoolName === 'string' ? body.schoolName.trim() : null;
    const gradeClass = typeof body?.gradeClass === 'string' ? body.gradeClass.trim() : null;
    const bloodGroup = typeof body?.bloodGroup === 'string' ? body.bloodGroup.trim() : null;
    const Board = typeof body?.Board === 'string' ? body.Board.trim() : null;
    const profilePhotoUrl =
      typeof body?.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : null;
    const guardianFirstName = typeof body?.guardianFirstName === 'string' ? body.guardianFirstName.trim() : null;
    const guardianLastName = typeof body?.guardianLastName === 'string' ? body.guardianLastName.trim() : null;

    const addressLine1 = typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : null;
    const addressLine2 = typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : null;
    const city = typeof body?.city === 'string' ? body.city.trim() : null;
    const state = typeof body?.state === 'string' ? body.state.trim() : null;
    const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim() : null;

    if (!firstName || firstName.length > 100) {
      return NextResponse.json({ message: 'First name is required' }, { status: 400 });
    }
    if (!lastName || lastName.length > 100) {
      return NextResponse.json({ message: 'Last name is required' }, { status: 400 });
    }
    if (!email || email.length === 0 || email.length > 100 || !email.includes('@')) {
      return NextResponse.json({ message: 'Valid email is required' }, { status: 400 });
    }
    if (!phone || phone.length === 0 || phone.length > 20) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (!/^\d+$/.test(phone)) {
      return NextResponse.json({ message: 'Phone number must contain only digits' }, { status: 400 });
    }
    if (!guardianFirstName || guardianFirstName.length === 0 || guardianFirstName.length > 100) {
      return NextResponse.json({ message: 'Parent first name is required' }, { status: 400 });
    }
    if (!guardianLastName || guardianLastName.length === 0 || guardianLastName.length > 100) {
      return NextResponse.json({ message: 'Parent last name is required' }, { status: 400 });
    }
    if (!gender || !['Male', 'Female'].includes(gender)) {
      return NextResponse.json({ message: 'Gender is required' }, { status: 400 });
    }
    if (!dob || Number.isNaN(dob.getTime())) {
      return NextResponse.json({ message: 'Date of birth is required' }, { status: 400 });
    }
    if (!bloodGroup || bloodGroup.length > 5) {
      return NextResponse.json({ message: 'Blood group is required' }, { status: 400 });
    }
    if (!schoolName || schoolName.length === 0 || schoolName.length > 100) {
      return NextResponse.json({ message: 'School name is required' }, { status: 400 });
    }
    if (!Board || !['CBSE', 'ICSE', 'IB', 'State'].includes(Board)) {
      return NextResponse.json({ message: 'Board is required' }, { status: 400 });
    }
    if (!gradeClass || gradeClass.length === 0 || gradeClass.length > 20) {
      return NextResponse.json({ message: 'Grade/class is required' }, { status: 400 });
    }
    if (!locationId || locationId <= 0 || Number.isNaN(locationId)) {
      return NextResponse.json({ message: 'Location is required' }, { status: 400 });
    }
    if (!addressLine1 || addressLine1.length === 0) {
      return NextResponse.json({ message: 'Address line 1 is required' }, { status: 400 });
    }
    if (!city || city.length === 0) {
      return NextResponse.json({ message: 'City is required' }, { status: 400 });
    }
    if (!state || state.length === 0) {
      return NextResponse.json({ message: 'State is required' }, { status: 400 });
    }
    if (!postalCode || postalCode.length === 0) {
      return NextResponse.json({ message: 'Postal code is required' }, { status: 400 });
    }

    const [location, tenantRow] = await Promise.all([
      prisma.location.findFirst({
        where: { id: locationId, tenantId: tenant.id, isActive: true },
        select: { id: true },
      }),
      prisma.tenant.findUnique({
        where: { id: tenant.id },
        select: { academyCode: true },
      }),
    ]);
    if (!location) {
      return NextResponse.json({ message: 'Location not found or not available for this academy.' }, { status: 400 });
    }
    if (!tenantRow?.academyCode?.trim()) {
      return NextResponse.json(
        { message: 'Academy code is not configured. Please contact the academy.' },
        { status: 400 },
      );
    }

    const academyCode = tenantRow.academyCode.trim();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const regNoPrefix = `${academyCode}-${year}-${month}-`;
    const existingCountThisMonth = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        registrationNo: { startsWith: regNoPrefix },
      },
    });

    let guardianAddress: Prisma.InputJsonValue =
      Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    if (addressLine1 || addressLine2 || city || state || postalCode) {
      guardianAddress = {
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
      };
    }

    let resolvedSportCategoryName: string | null = null;
    const gymnastics = await prisma.sportsCategory.findFirst({
      where: { categoryName: { equals: 'Gymnastics' } },
      select: { categoryName: true },
    });
    resolvedSportCategoryName = gymnastics?.categoryName || 'Gymnastics';

    const result = await prisma.$transaction(async (tx) => {
      let sequence = existingCountThisMonth + 1;
      let generatedRegNo = `${regNoPrefix}${sequence}`;
      while (true) {
        const dup = await tx.student.findFirst({
          where: { tenantId: tenant.id, registrationNo: generatedRegNo },
          select: { id: true },
        });
        if (!dup) break;
        sequence += 1;
        generatedRegNo = `${regNoPrefix}${sequence}`;
      }

      let guardianUser = null;
      let passwordSetupToken: string | null = null;
      if (email) {
        const guardianRole = await tx.userRole.findFirst({
          where: {
            OR: [{ slug: 'parent' }, { name: 'parent' }],
          },
        });
        if (!guardianRole) {
          throw new Error('Guardian role not found. Please contact support.');
        }
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (existingUser) {
          guardianUser = existingUser;
        } else {
          const userName = guardianFirstName || firstName;
          const userLastName = guardianFirstName ? guardianLastName ?? undefined : lastName ?? undefined;
          guardianUser = await tx.user.create({
            data: {
              tenantId: tenant.id,
              locationId: locationId!,
              roleId: guardianRole.id,
              name: userName,
              lastName: userLastName,
              email,
              password: '',
              status: 'ACTIVE',
              createdBy: actingUser.id,
            },
          });
          passwordSetupToken = crypto.randomBytes(48).toString('hex');
          const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
          await tx.verificationToken.create({
            data: {
              identifier: guardianUser.id,
              token: passwordSetupToken,
              expires: passwordSetupExpiry,
            },
          });
        }
      }

      const newStudent = await tx.student.create({
        data: {
          tenantId: tenant.id,
          locationId: locationId!,
          registrationNo: generatedRegNo,
          firstName,
          lastName,
          email,
          phone,
          bloodGroup: bloodGroup || null,
          gender: (gender as Gender) || 'Male',
          userId: guardianUser ? guardianUser.id : null,
          dob: dob || null,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          city: city || null,
          state: state || null,
          postalCode: postalCode || null,
          Board: Board || null,
          skilllevelName: null,
          team: null,
          profilePhotoUrl: profilePhotoUrl || null,
          courseId: null,
          lastfeesamt: null,
          lastfeesdate: null,
          nextduedate: null,
          notes: 'Registered via public student registration.',
          deactivateDate: null,
          joinDate: joinDate || null,
          schoolName: schoolName || null,
          gradeClass: gradeClass || null,
          sportCategoryName: resolvedSportCategoryName,
          country: 'India',
          createdBy: actingUser.id,
        },
      });

      const guardian = await tx.guardian.create({
        data: {
          tenantId: tenant.id,
          userId: guardianUser ? guardianUser.id : null,
          firstName: guardianFirstName!,
          lastName: guardianLastName || null,
          email,
          address: guardianAddress,
          createdBy: actingUser.id,
        },
      });

      await tx.studentGuardian.create({
        data: {
          studentId: newStudent.id,
          guardianId: guardian.id,
          isPrimary: true,
          createdBy: actingUser.id,
        },
      });

      await systemLog(
        {
          event: 'create',
          userId: actingUser.id,
          entityId: Number(newStudent.id).toString(),
          entityType: 'student',
          description: 'Student registered via public link.',
          ipAddress: clientIp,
        },
        tx,
      );

      return { student: newStudent, passwordSetupToken };
    });

    if (result.passwordSetupToken && email) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${result.passwordSetupToken}`;

        const tenantMeta = await prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: { academyName: true },
        });

        const greetingName = `${guardianFirstName}${guardianLastName ? ` ${guardianLastName}` : ''}`;
        await sendEmail({
          to: email,
          tenantId: tenant.id,
          subject: `Welcome to ${tenantMeta?.academyName || 'My Academy'}!`,
          content: {
            title: `Hello, ${greetingName}`,
            subtitle: 'Your account has been created. Please set your password using the link below.',
            buttonLabel: 'Set Password',
            buttonUrl: passwordSetupUrl,
            description: 'This link expires in 48 hours. If you did not register, please contact your academy.',
          },
        });
      } catch (emailError: unknown) {
        console.error('Public student registration: email failed:', getErrorMessage(emailError));
      }
    }

    return NextResponse.json(jsonBigInt(result.student));
  } catch (error: unknown) {
    console.error('POST public student-register:', error);
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
