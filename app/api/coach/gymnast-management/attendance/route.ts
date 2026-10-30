import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getCoachAllowedStudentSkillLevelValues } from '@/lib/api/coach-student-skill-filter';

const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Search students by location, day, and time
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const day = searchParams.get('day'); // monday, tuesday, etc.
  const time = searchParams.get('time'); // e.g., "9am", "2pm"
  const sessionDate = searchParams.get('sessionDate'); // Optional: to check attendance status
  const programId = searchParams.get('programId'); // Optional: filter by batch (program+course)
  const courseId = searchParams.get('courseId');

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!tenantContext.isCoach && !tenantContext.isManager && !tenantContext.isAdmin && !tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    if (!locationId || !day || !time) {
      return NextResponse.json(
        { message: 'Location, day, and time are required' },
        { status: 400 },
      );
    }

    const locationIdNum = parseInt(locationId);
    if (isNaN(locationIdNum)) {
      return NextResponse.json(
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    const restrictedCoach =
      tenantContext.isCoach &&
      !tenantContext.isAdmin &&
      !tenantContext.isOwner &&
      !tenantContext.isManager;
    if (restrictedCoach && tenantContext.locationId != null && locationIdNum !== tenantContext.locationId) {
      return NextResponse.json(
        { message: 'You can only access attendance for your assigned center' },
        { status: 403 },
      );
    }

    // Validate day
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(day.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid day' },
        { status: 400 },
      );
    }

    // Build the where clause for batches
    const dayField = day.toLowerCase() as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    const batchWhereClause: any = {
      tenantId: tenantContext.tenantId,
      locationId: locationIdNum,
      isActive: true,
      [dayField]: time,
    };
    if (programId && courseId) {
      const pid = parseInt(programId);
      const cid = parseInt(courseId);
      if (!isNaN(pid) && !isNaN(cid)) {
        batchWhereClause.programId = pid;
        batchWhereClause.courseId = cid;
      }
    }

    // Find all batches matching the criteria
    const batches = await prisma.batch.findMany({
      where: batchWhereClause,
      include: {
        course: {
          select: {
            id: true,
            courseName: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }) as any[];

    // Get unique student IDs
    const studentIdsSet = new Set<bigint>();
    batches.forEach((batch: any) => {
      studentIdsSet.add(batch.studentId);
    });
    const studentIds = Array.from(studentIdsSet);

    if (studentIds.length === 0) {
      return NextResponse.json(jsonBigInt([]));
    }

    const coachSkillValues = await getCoachAllowedStudentSkillLevelValues(tenantContext);
    const studentWhere: {
      id: { in: bigint[] };
      tenantId: number | undefined;
      locationId: number;
      status: 'ACTIVE';
      skilllevelName?: { in: string[] };
    } = {
      id: { in: studentIds },
      tenantId: tenantContext.tenantId,
      locationId: locationIdNum,
      status: 'ACTIVE',
    };
    if (coachSkillValues !== null) {
      if (coachSkillValues.length === 0) {
        return NextResponse.json(jsonBigInt([]));
      }
      studentWhere.skilllevelName = { in: coachSkillValues };
    }

    // Fetch students with their location to filter by location (and skill level for pure coaches)
    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        locationId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    // Check attendance status if sessionDate is provided
    let attendanceStatusMap = new Map<string, boolean>();
    if (sessionDate) {
      const date = new Date(sessionDate);
      if (!isNaN(date.getTime())) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const studentIdsBigInt = students.map(s => BigInt(s.id));
        const existingAttendance = await prisma.attendance.findMany({
          where: {
            studentId: { in: studentIdsBigInt },
            tenantId: tenantContext.tenantId,
            locationId: locationIdNum,
            sessionDate: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
          select: {
            studentId: true,
          },
        });

        existingAttendance.forEach(a => {
          attendanceStatusMap.set(a.studentId.toString(), true);
        });
      }
    }

    // Map students with their batch information and attendance status
    const studentsWithBatches = students.map(student => {
      const studentBatches = batches.filter((batch: any) => batch.studentId.toString() === student.id.toString());
      return {
        ...student,
        batches: studentBatches.map((batch: any) => ({
          id: batch.id,
          courseName: batch.course?.courseName || null,
          programName: batch.program?.name || null,
        })),
        hasAttendance: attendanceStatusMap.has(student.id.toString()),
      };
    });

    return NextResponse.json(jsonBigInt(studentsWithBatches));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Mark attendance for selected students
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!tenantContext.isCoach && !tenantContext.isManager && !tenantContext.isAdmin && !tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await request.json();

    const { studentIds, locationId, sessionDate } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { message: 'At least one student must be selected' },
        { status: 400 },
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { message: 'Location is required' },
        { status: 400 },
      );
    }

    if (!sessionDate) {
      return NextResponse.json(
        { message: 'Session date is required' },
        { status: 400 },
      );
    }

    const locationIdNum = parseInt(locationId);
    if (isNaN(locationIdNum)) {
      return NextResponse.json(
        { message: 'Invalid location ID' },
        { status: 400 },
      );
    }

    const date = new Date(sessionDate);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { message: 'Invalid date format' },
        { status: 400 },
      );
    }

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: locationIdNum,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found or access denied' },
        { status: 400 },
      );
    }

    const restrictedCoachPost =
      tenantContext.isCoach &&
      !tenantContext.isAdmin &&
      !tenantContext.isOwner &&
      !tenantContext.isManager;
    if (restrictedCoachPost && tenantContext.locationId != null && locationIdNum !== tenantContext.locationId) {
      return NextResponse.json(
        { message: 'You can only mark attendance at your assigned center' },
        { status: 403 },
      );
    }

    // Convert student IDs to BigInt
    const studentIdsBigInt = studentIds.map((id: string) => BigInt(id));

    const coachSkillValues = await getCoachAllowedStudentSkillLevelValues(tenantContext);
    const verifyWhere: {
      id: { in: bigint[] };
      tenantId: number | undefined;
      locationId: number;
      skilllevelName?: { in: string[] };
    } = {
      id: { in: studentIdsBigInt },
      tenantId: tenantContext.tenantId,
      locationId: locationIdNum,
    };
    if (coachSkillValues !== null) {
      if (coachSkillValues.length === 0) {
        return NextResponse.json(
          { message: 'No skill levels assigned to your coach profile' },
          { status: 403 },
        );
      }
      verifyWhere.skilllevelName = { in: coachSkillValues };
    }

    // Verify all students belong to tenant and location (and skill level for pure coaches)
    const students = await prisma.student.findMany({
      where: verifyWhere,
      select: {
        id: true,
      },
    });

    if (students.length !== studentIds.length) {
      return NextResponse.json(
        {
          message:
            coachSkillValues !== null
              ? 'Some students were not found, are outside your assigned skill levels, or do not belong to the specified location'
              : 'Some students were not found or do not belong to the specified location',
        },
        { status: 400 },
      );
    }

    // Check for existing attendance records to avoid duplicates
    // Normalize date to start of day for comparison
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const startOfDay = new Date(normalizedDate);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAttendance = await prisma.attendance.findMany({
      where: {
        studentId: { in: studentIdsBigInt },
        tenantId: tenantContext.tenantId,
        locationId: locationIdNum,
        sessionDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      select: {
        studentId: true,
      },
    });

    const existingStudentIdsSet = new Set<string>();
    existingAttendance.forEach(a => {
      existingStudentIdsSet.add(a.studentId.toString());
    });

    // Filter out students who already have attendance for this date
    const newStudentIds = studentIdsBigInt.filter(
      id => !existingStudentIdsSet.has(id.toString())
    );

    if (newStudentIds.length === 0) {
      return NextResponse.json(
        { 
          message: 'All selected students already have attendance marked for this date',
          duplicateStudentIds: Array.from(existingStudentIdsSet),
        },
        { status: 400 },
      );
    }

    // Create attendance records
    const sessionDateForRecord = new Date(date);
    sessionDateForRecord.setHours(0, 0, 0, 0);
    
    const attendanceRecords = newStudentIds.map(studentId => ({
      studentId,
      tenantId: tenantContext.tenantId!,
      locationId: locationIdNum,
      sessionDate: sessionDateForRecord,
      createdBy: tenantContext.user.id,
    }));

    const result = await prisma.attendance.createMany({
      data: attendanceRecords,
    });

    return NextResponse.json(
      jsonBigInt({
        message: `Attendance marked successfully for ${result.count} student(s)`,
        count: result.count,
        skipped: studentIds.length - result.count,
      }),
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

