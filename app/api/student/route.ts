import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import crypto from 'crypto';
import { sendEmail, EmailTemplateType } from '@/services/send-email';
import { jsonBigInt, getErrorMessage } from '@/types/api';
import type { Gender } from '@/types/enums';
import { Prisma, UserStatus } from '@prisma/client';

// GET: Fetch all students (paginated, filtered, sorted)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const rawStatus = searchParams.get('status');
  const status = rawStatus ? rawStatus.trim() : null;
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.isOwner && !tenantContext.isAdmin&& !tenantContext.isCoach) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const andConditions: Prisma.StudentWhereInput[] = [
      { tenantId: tenantContext.tenantId },
      { deletedAt: null }, // Exclude soft-deleted students
      {
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { registrationNo: { contains: query } },
        ],
      },
    ];

    if (status && ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      andConditions.push({ status: status as UserStatus });
    }

    const whereClause: Prisma.StudentWhereInput = { AND: andConditions };

    const total = await prisma.student.count({ where: whereClause });

    const students = await prisma.student.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDirection },
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        status: true,
        joinDate: true,
        createdAt: true,
        team: true,
        skilllevelName: true,
      },
    });

    // Fetch team names for lookup
    const teamIds = students.map(s => s.team).filter((id): id is string => !!id);

    // Create lookup map for teams
    const teamMap = new Map<string, string>();

    if (teamIds.length > 0) {
      const uniqueTeamIds = Array.from(new Set(teamIds));
      const teams = await prisma.team.findMany({
        where: {
          id: { in: uniqueTeamIds.map(id => parseInt(id, 10)) },
          tenantId: tenantContext.tenantId,
        },
        select: {
          id: true,
          name: true,
        },
      });
      teams.forEach(team => {
        teamMap.set(String(team.id), team.name);
      });
    }

    // Map team and skill level names to students
    const studentsWithNames = students.map(student => ({
      ...student,
      teamName: student.team ? teamMap.get(student.team) || null : null,
      skillLevelName: student.skilllevelName || null,
    }));

    return NextResponse.json(
      jsonBigInt({
        data: studentsWithNames,
        pagination: {
          total,
          page,
          limit,
          hasNext: skip + students.length < total,
          hasPrev: page > 1,
        },
      }),
    );
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new student
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : null;
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const gender = typeof body?.gender === 'string' ? body.gender : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : tenantContext.locationId;
    const joinDate = body?.joinDate ? new Date(body.joinDate) : null;
    const dob = body?.dob ? new Date(body.dob) : null;
    // Additional fields
    const schoolName = typeof body?.schoolName === 'string' ? body.schoolName.trim() : null;
    const gradeClass = typeof body?.gradeClass === 'string' ? body.gradeClass.trim() : null;
    const bloodGroup = typeof body?.bloodGroup === 'string' ? body.bloodGroup.trim() : null;
    const Board = typeof body?.Board === 'string' ? body.Board.trim() : null;
    const skilllevelNameInput = typeof body?.skilllevelName === 'string' ? body.skilllevelName.trim() : null;
    const legacySkillLevelValue = typeof body?.currentSkillLevelId === 'string' ? body.currentSkillLevelId.trim() : null;
    const team = typeof body?.team === 'string' ? body.team.trim() : null;
    // Optional incoming sports category; if not provided, default to Gymnastics
    const sportCategoryNameInput = typeof body?.sportCategoryName === 'string' ? body.sportCategoryName.trim() : null;
    const sportCategoryIdInput = typeof body?.sportCategoryId === 'string' ? body.sportCategoryId : null;
    // Trial ID for updating isRegistered status
    const trialId = typeof body?.trialId === 'string' || typeof body?.trialId === 'number' ? BigInt(body.trialId) : null;

    // Guardian information
    const guardianFirstName = typeof body?.guardianFirstName === 'string' ? body.guardianFirstName.trim() : null;
    const guardianLastName = typeof body?.guardianLastName === 'string' ? body.guardianLastName.trim() : null;
    
    // Address fields from student form
    const addressLine1 = typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : null;
    const addressLine2 = typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : null;
    const city = typeof body?.city === 'string' ? body.city.trim() : null;
    const state = typeof body?.state === 'string' ? body.state.trim() : null;
    const postalCode = typeof body?.postalCode === 'string' ? body.postalCode.trim() : null;

    if (!firstName || firstName.length > 100) {
      return NextResponse.json({ message: 'Invalid firstName' }, { status: 400 });
    }
    if (lastName && lastName.length > 100) {
      return NextResponse.json({ message: 'Invalid lastName' }, { status: 400 });
    }
    // registrationNo will be auto-generated
    if (!email || email.length === 0) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }
    if (email.length > 100 || !email.includes('@')) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
    }
    if (!phone || phone.trim().length === 0) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }
    if (phone.length > 20) {
      return NextResponse.json({ message: 'Invalid phone' }, { status: 400 });
    }
    if (!guardianFirstName || guardianFirstName.length === 0) {
      return NextResponse.json({ message: 'Parent first name is required' }, { status: 400 });
    }
    if (!guardianLastName || guardianLastName.length === 0) {
      return NextResponse.json({ message: 'Parent last name is required' }, { status: 400 });
    }
    if (bloodGroup && bloodGroup.length > 5) {
      return NextResponse.json({ message: 'Invalid bloodGroup' }, { status: 400 });
    }
    if (schoolName && schoolName.length > 100) {
      return NextResponse.json({ message: 'Invalid schoolName' }, { status: 400 });
    }
    if (gradeClass && gradeClass.length > 20) {
      return NextResponse.json({ message: 'Invalid gradeClass' }, { status: 400 });
    }
    if (!locationId || locationId <= 0) {
      return NextResponse.json({ message: 'Invalid locationId' }, { status: 400 });
    }
    if (gender && !['Male', 'Female'].includes(gender)) {
      // gender guard; UserStatus strings are not valid here but keep check permissive to avoid runtime issues if client sends wrong field
    }

    // Resolve location (required for student record) and tenant academyCode for registration format
    const [location, tenant] = await Promise.all([
      prisma.location.findFirst({
        where: { id: locationId, tenantId: tenantContext.tenantId },
        select: { id: true },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantContext.tenantId! },
        select: { academyCode: true },
      }),
    ]);
    if (!location) {
      return NextResponse.json({ message: 'Location not found' }, { status: 400 });
    }
    if (!tenant?.academyCode?.trim()) {
      return NextResponse.json(
        { message: 'Academy code is not set. Please set academy code in tenant settings.' },
        { status: 400 },
      );
    }
    const academyCode = tenant.academyCode.trim();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const regNoPrefix = `${academyCode}-${year}-${month}-`;
    const existingCountThisMonth = await prisma.student.count({
      where: {
        tenantId: tenantContext.tenantId,
        registrationNo: { startsWith: regNoPrefix },
      },
    });

    // Validate guardian information if provided
    if (guardianFirstName && guardianFirstName.length > 100) {
      return NextResponse.json({ message: 'Invalid guardian firstName' }, { status: 400 });
    }
    if (guardianLastName && guardianLastName.length > 100) {
      return NextResponse.json({ message: 'Invalid guardian lastName' }, { status: 400 });
    }

    // Build address JSON for guardian if any address fields are provided
    let guardianAddress: Prisma.InputJsonValue =
      Prisma.JsonNull as unknown as Prisma.InputJsonValue;
    if (addressLine1 || addressLine2 || city || state || postalCode) {
      guardianAddress = {
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        postalCode: postalCode || null,
        // country removed per requirement; defaulting student country to 'India'
      };
    }

    // Resolve sport category name if not provided directly
    let resolvedSportCategoryName: string | null = sportCategoryNameInput || null;
    if (!resolvedSportCategoryName && sportCategoryIdInput) {
      const parsedCategoryId = parseInt(sportCategoryIdInput, 10);
      if (!Number.isNaN(parsedCategoryId)) {
        const sportCategory = await prisma.sportsCategory.findUnique({
          where: { id: parsedCategoryId },
          select: { categoryName: true },
        });
        resolvedSportCategoryName = sportCategory?.categoryName || null;
      }
    }
    if (!resolvedSportCategoryName) {
      const gymnastics = await prisma.sportsCategory.findFirst({
        where: { categoryName: { equals: 'Gymnastics' } },
        select: { categoryName: true },
      });
      resolvedSportCategoryName = gymnastics?.categoryName || 'Gymnastics';
    }

    const resolvedSkilllevelName = skilllevelNameInput || legacySkillLevelValue || null;
    if (!resolvedSkilllevelName || resolvedSkilllevelName.length === 0) {
      return NextResponse.json({ message: 'Skill level is required' }, { status: 400 });
    }

    // Transaction: generate registrationNo, create student, and optionally create/link guardian user
    const result = await prisma.$transaction(async (tx) => {
      // Format: AcademyCode-Year-Month-Sequence (e.g. RNR-2016-07-104)
      let sequence = existingCountThisMonth + 1;
      let generatedRegNo = `${regNoPrefix}${sequence}`;
      while (true) {
        const dup = await tx.student.findFirst({
          where: { tenantId: tenantContext.tenantId, registrationNo: generatedRegNo },
          select: { id: true },
        });
        if (!dup) break;
        sequence += 1;
        generatedRegNo = `${regNoPrefix}${sequence}`;
      }
      // Create or find user when email is provided (so student.userId is set); use guardian name if provided, else student name
      let guardian = null;
      let guardianUser = null;
      let passwordSetupToken: string | null = null;
      if (email) {
        const guardianRole = await tx.userRole.findFirst({
          where: {
            OR: [
              { slug: 'parent' },
              { name: 'parent' },
            ],
          },
        });
        if (!guardianRole) {
          throw new Error('Guardian role not found. Please ensure a guardian/parent/member role exists.');
        }
        const existingUser = await tx.user.findUnique({ where: { email } });
        if (existingUser) {
          guardianUser = existingUser;
        } else {
          const userName = guardianFirstName || firstName;
          const userLastName = guardianFirstName ? (guardianLastName ?? undefined) : (lastName ?? undefined);
          guardianUser = await tx.user.create({
            data: {
              tenantId: tenantContext.tenantId,
              locationId: locationId!,
              roleId: guardianRole.id,
              name: userName,
              lastName: userLastName,
              email: email,
              password: '', // User will set password via email link
              status: 'ACTIVE',
              createdBy: tenantContext.user.id,
            },
          });
          passwordSetupToken = crypto.randomBytes(48).toString('hex');
          const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
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
          tenantId: tenantContext.tenantId!,
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
          skilllevelName: resolvedSkilllevelName,
          team: team || null,
          // Set specified fields to null on insert
          courseId: null,
          lastfeesamt: null,
          lastfeesdate: null,
          nextduedate: null,
          notes: null,
          deactivateDate: null,
          joinDate: joinDate || null,
          schoolName: schoolName || null,
          gradeClass: gradeClass || null,
          sportCategoryName: resolvedSportCategoryName,
          country: 'India',
          createdBy: tenantContext.user.id,
        },
      });

      // Create guardian record if guardian information is provided
      if (guardianFirstName) {
        // Create guardian record (Guardian.email can be the same as student email for contact purposes)
        guardian = await tx.guardian.create({
          data: {
            tenantId: tenantContext.tenantId!,
            userId: guardianUser ? guardianUser.id : null,
            firstName: guardianFirstName,
            lastName: guardianLastName || null,
            email: email, // Use the same email captured in the form
            address: guardianAddress,
            createdBy: tenantContext.user.id,
          },
        });

        // Create StudentGuardian relationship
        await tx.studentGuardian.create({
          data: {
            studentId: newStudent.id,
            guardianId: guardian.id,
            isPrimary: true, // First guardian is primary by default
            createdBy: tenantContext.user.id,
          },
        });
      }

      // Update trial's isRegistered status if trialId is provided
      if (trialId) {
        await tx.trial.update({
          where: { id: trialId },
          data: { isRegistered: true },
        });
      }

      await systemLog(
        {
          event: 'create',
          userId: tenantContext.user.id,
          entityId: Number(newStudent.id).toString(),
          entityType: 'student',
          description: 'Student added.',
          ipAddress: clientIp,
        },
        tx,
      );

      return { student: newStudent, guardian, passwordSetupToken };
    });

    // Send password setup email if a new user was created (don't fail student creation if email fails)
    if (result.passwordSetupToken && email) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${result.passwordSetupToken}`;

        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { academyName: true },
        });

        const greetingName = guardianFirstName
          ? `${guardianFirstName}${guardianLastName ? ` ${guardianLastName}` : ''}`
          : `${firstName}${lastName ? ` ${lastName}` : ''}`;
        await sendEmail({
          to: email,
          tenantId: tenantContext.tenantId,
          subject: `Welcome to ${tenant?.academyName || 'My Academy'}!`,
          content: {
            title: `Hello, ${greetingName}`,
            subtitle: 'Your account has been created. Please set your password using the link below.',
            buttonLabel: 'Set Password',
            buttonUrl: passwordSetupUrl,
            description: 'This link expires in 48 hours. If you did not request this account, please contact your academy.',
          },
        });
        console.log(`Password setup email sent successfully to ${email} for student ${result.student.id}`);
      } catch (emailError: unknown) {
        // Log error but don't fail student creation
        console.error(`Failed to send password setup email to ${email}:`, emailError);
        console.error('Student created successfully but email notification failed:', {
          studentId: result.student.id,
          email: email,
          error: getErrorMessage(emailError),
        });
      }
    }

    return NextResponse.json(jsonBigInt(result.student));
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

