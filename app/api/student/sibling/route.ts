import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// POST: Add a sibling student (links to existing guardian)
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

    const siblingStudentId = typeof body?.siblingStudentId === 'string' || typeof body?.siblingStudentId === 'number' 
      ? BigInt(body.siblingStudentId) 
      : null;

    if (!siblingStudentId) {
      return NextResponse.json({ message: 'siblingStudentId is required' }, { status: 400 });
    }

    // Get the existing sibling student and their guardian info
    const siblingStudent = await prisma.student.findFirst({
      where: { 
        id: siblingStudentId, 
        tenantId: tenantContext.tenantId 
      },
      include: {
        studentguardians: {
          include: {
            guardian: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
                userId: true,
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!siblingStudent) {
      return NextResponse.json({ message: 'Sibling student not found' }, { status: 404 });
    }

    // Get the primary guardian or first guardian
    const primaryGuardian = siblingStudent.studentguardians?.find((g: any) => g.isPrimary) 
      || siblingStudent.studentguardians?.[0];

    if (!primaryGuardian) {
      return NextResponse.json({ message: 'No guardian found for sibling student' }, { status: 400 });
    }

    const existingGuardian = primaryGuardian.guardian;

    // Extract student form data
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : null;
    const email = existingGuardian.email || siblingStudent.email; // Use guardian/student email
    const phone = existingGuardian.phone || siblingStudent.phone; // Use guardian/student phone
    const userId = existingGuardian.userId || siblingStudent.userId || null; // Use guardian/student userId
    const gender = typeof body?.gender === 'string' ? body.gender : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : siblingStudent.locationId;
    const joinDate = body?.joinDate ? new Date(body.joinDate) : null;
    const dob = body?.dob ? new Date(body.dob) : null;
    
    // Additional fields
    const schoolName = typeof body?.schoolName === 'string' ? body.schoolName.trim() : null;
    const gradeClass = typeof body?.gradeClass === 'string' ? body.gradeClass.trim() : null;
    const bloodGroup = typeof body?.bloodGroup === 'string' ? body.bloodGroup.trim() : null;
    const Board = typeof body?.Board === 'string' ? body.Board.trim() : null;
    const skilllevelName = typeof body?.currentSkillLevelId === 'string' ? body.currentSkillLevelId.trim() : null;
    const team = typeof body?.team === 'string' ? body.team.trim() : null;
    const sportCategoryIdInput = typeof body?.sportCategoryId === 'string' ? body.sportCategoryId : null;
    const profilePhotoUrl = typeof body?.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : null;

    // Address from existing student/guardian
    const guardianAddress = existingGuardian.address as any || {};
    const addressLine1 = guardianAddress.addressLine1 || siblingStudent.addressLine1 || null;
    const addressLine2 = guardianAddress.addressLine2 || siblingStudent.addressLine2 || null;
    const city = guardianAddress.city || siblingStudent.city || null;
    const state = guardianAddress.state || siblingStudent.state || null;
    const postalCode = guardianAddress.postalCode || siblingStudent.postalCode || null;

    if (!firstName || firstName.length > 100) {
      return NextResponse.json({ message: 'Invalid firstName' }, { status: 400 });
    }
    if (lastName && lastName.length > 100) {
      return NextResponse.json({ message: 'Invalid lastName' }, { status: 400 });
    }
    if (email && (email.length > 100 || !email.includes('@'))) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 });
    }
    if (phone && phone.length > 20) {
      return NextResponse.json({ message: 'Invalid phone' }, { status: 400 });
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

    // Resolve location and tenant academyCode for registration format: AcademyCode-Year-Month-Sequence
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

    // Resolve default sports category if not provided
    let resolvedSportCategoryId: string | null = sportCategoryIdInput;
    if (!resolvedSportCategoryId) {
      const gymnastics = await prisma.sportsCategory.findFirst({
        where: { categoryName: { equals: 'Gymnastics' } },
        select: { id: true },
      });
      resolvedSportCategoryId = gymnastics ? String(gymnastics.id) : null;
    }

    // Transaction: generate registrationNo, create student, and link to existing guardian
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

      // Create new student (without creating user/guardian)
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
          gender: (gender as any) || 'Male',
          userId: userId, // Use guardian/student userId
          dob: dob || null,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          city: city || null,
          state: state || null,
          postalCode: postalCode || null,
          Board: Board || null,
          skilllevelName: skilllevelName || null,
          team: team || null,
          profilePhotoUrl: profilePhotoUrl || null,
          courseId: null,
          lastfeesamt: null,
          lastfeesdate: null,
          nextduedate: null,
          notes: null,
          deactivateDate: null,
          joinDate: joinDate || null,
          schoolName: schoolName || null,
          gradeClass: gradeClass || null,
          // sportCategoryId: resolvedSportCategoryId,
          country: 'India',
          createdBy: tenantContext.user.id,
        },
      });

      // Link new student to existing guardian via StudentGuardian table
      await tx.studentGuardian.create({
        data: {
          studentId: newStudent.id,
          guardianId: existingGuardian.id,
          isPrimary: false, // Not primary since sibling already has primary
          createdBy: tenantContext.user.id,
        },
      });

      await systemLog(
        {
          event: 'create',
          userId: tenantContext.user.id,
          entityId: Number(newStudent.id).toString(),
          entityType: 'student',
          description: 'Sibling student added.',
          ipAddress: clientIp,
        },
        tx,
      );

      return { student: newStudent };
    });

    return NextResponse.json(jsonBigInt(result.student));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

