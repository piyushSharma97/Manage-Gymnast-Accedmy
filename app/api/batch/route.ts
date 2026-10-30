import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch all batches
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const programId = searchParams.get('programId');
  const courseId = searchParams.get('courseId');
  const coachId = searchParams.get('coachId');
  const studentId = searchParams.get('studentId');
  const skip = (page - 1) * limit;

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view batches
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {
      AND: [
        {
          tenantId: tenantContext.tenantId,
        },
      ],
    };

     // Handle search query - search by student name
    if (query) {
      const matchingStudents = await prisma.student.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          deletedAt: null,
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { registrationNo: { contains: query } },
          ],
        },
        select: { id: true },
      });
      
      if (matchingStudents.length > 0) {
        const studentIds = matchingStudents.map(s => s.id);
        whereClause.AND.push({
          studentId: { in: studentIds },
        });
      } else {
        // No matching students, return empty result
        whereClause.AND.push({ id: -1 }); // Impossible condition
      }
    }

    if (isActive === 'true' || isActive === 'false') {
      whereClause.AND.push({ isActive: isActive === 'true' });
    }

    if (programId) {
      whereClause.AND.push({ programId: parseInt(programId) });
    }

    if (courseId) {
      whereClause.AND.push({ courseId: parseInt(courseId) });
    }

    if (coachId) {
      whereClause.AND.push({ coachId: parseInt(coachId) });
    }

    if (studentId) {
      whereClause.AND.push({ studentId: BigInt(studentId) });
    }

    // If no search query, show only latest batch per student
    let batches: any[] = [];
    let total = 0;
    
    if (!query) {
      // Get all batches matching filters, ordered by createdAt desc
      const allBatches = await prisma.batch.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          program: {
            select: {
              id: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              courseName: true,
              courseCode: true,
            },
          },
          coach: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          tenant: {
            select: {
              id: true,
              academyName: true,
            },
          },
        },
      } as any);

      // Group by studentId and keep only the latest batch for each student
      const latestBatchMap = new Map<string, any>();
      for (const batch of allBatches) {
        const studentIdStr = batch.studentId.toString();
        if (!latestBatchMap.has(studentIdStr)) {
          latestBatchMap.set(studentIdStr, batch);
        }
      }

      batches = Array.from(latestBatchMap.values());
      total = batches.length;

      // Apply sorting
      if (sortField && sortField !== 'createdAt') {
        batches.sort((a, b) => {
          let aVal: any;
          let bVal: any;
          
          // Handle nested fields
          if (sortField === 'program.name') {
            aVal = a.program?.name || '';
            bVal = b.program?.name || '';
          } else if (sortField === 'course.courseName') {
            aVal = a.course?.courseName || '';
            bVal = b.course?.courseName || '';
          } else if (sortField === 'coach.firstName') {
            aVal = a.coach?.firstName || '';
            bVal = b.coach?.firstName || '';
          } else {
            aVal = a[sortField];
            bVal = b[sortField];
          }
          
          // Handle null/undefined values
          if (aVal == null) aVal = '';
          if (bVal == null) bVal = '';
          
          if (sortDirection === 'desc') {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
          } else {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          }
        });
      } else if (sortField === 'createdAt' && sortDirection === 'asc') {
        // If sorting by createdAt asc, reverse the order
        batches.reverse();
      }

      // Apply pagination
      batches = batches.slice(skip, skip + limit);
    } else {
      // When searching, show all batches
      total = await prisma.batch.count({ where: whereClause });
      
      batches =
        total > 0
          ? await prisma.batch.findMany({
              skip,
              take: limit,
              where: whereClause,
              orderBy: {
                [sortField]: sortDirection,
              },
              include: {
                program: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                course: {
                  select: {
                    id: true,
                    courseName: true,
                    courseCode: true,
                  },
                },
                coach: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                tenant: {
                  select: {
                    id: true,
                    academyName: true,
                  },
                },
              },
            } as any)
          : [];
    }

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.batch.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    // Fetch student information for all batches
    const studentIds = batches.map((batch: any) => batch.studentId);
    const students = studentIds.length > 0
      ? await prisma.student.findMany({
          where: {
            id: { in: studentIds },
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
          },
        })
      : [];

    // Create a map of studentId to student data
    const studentMap = new Map(
      students.map(student => [student.id.toString(), student])
    );

    // Add student information to each batch
    const batchesWithStudents = batches.map((batch: any) => ({
      ...batch,
      student: studentMap.get(batch.studentId.toString()) || null,
    }));

    return NextResponse.json(
      jsonBigInt({
        data: batchesWithStudents,
        pagination: {
          total,
          page,
        },
        empty: isTableEmpty,
      })
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new batch
export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create batches
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const programId = typeof body?.programId === 'number' ? body.programId : null;
    const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
    const studentId = body?.studentId ? BigInt(body.studentId) : null;
    const coachId = typeof body?.coachId === 'number' ? body.coachId : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
    const paymentCycle = typeof body?.paymentCycle === 'string' ? body.paymentCycle : null;

    // Day of week time fields (VarChar(20) in schema)
    const monday = typeof body?.monday === 'string' ? body.monday.trim().substring(0, 20) : null;
    const tuesday = typeof body?.tuesday === 'string' ? body.tuesday.trim().substring(0, 20) : null;
    const wednesday = typeof body?.wednesday === 'string' ? body.wednesday.trim().substring(0, 20) : null;
    const thursday = typeof body?.thursday === 'string' ? body.thursday.trim().substring(0, 20) : null;
    const friday = typeof body?.friday === 'string' ? body.friday.trim().substring(0, 20) : null;
    const saturday = typeof body?.saturday === 'string' ? body.saturday.trim().substring(0, 20) : null;
    const sunday = typeof body?.sunday === 'string' ? body.sunday.trim().substring(0, 20) : null;

    if (!programId || programId <= 0) {
      return NextResponse.json(
        { message: 'Invalid programId' },
        { status: 400 },
      );
    }

    if (!courseId || courseId <= 0) {
      return NextResponse.json(
        { message: 'Invalid courseId' },
        { status: 400 },
      );
    }

    if (!studentId || studentId <= 0) {
      return NextResponse.json(
        { message: 'Invalid studentId' },
        { status: 400 },
      );
    }

    // Verify program exists and belongs to the tenant
    const program = await prisma.program.findFirst({
      where: { 
        id: programId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!program) {
      return NextResponse.json(
        { message: 'Program not found or access denied' },
        { status: 400 },
      );
    }

    // Verify course exists and belongs to the tenant
    const course = await prisma.course.findFirst({
      where: { 
        id: courseId,
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        perClass: true,
        monthly: true,
        quarterly: true,
        halfYearly: true,
      },
    });

    if (!course) {
      return NextResponse.json(
        { message: 'Course not found or access denied' },
        { status: 400 },
      );
    }

    // Validate payment cycle
    const validPaymentCycles = ['perClass', 'monthly', 'quarterly', 'halfYearly'];
    if (!paymentCycle || !validPaymentCycles.includes(paymentCycle)) {
      return NextResponse.json(
        { message: 'Valid payment cycle is required (perClass, monthly, quarterly, or halfYearly)' },
        { status: 400 },
      );
    }

    // Calculate amount based on payment cycle
    let amount: number | null = null;
    if (paymentCycle === 'perClass') {
      amount = course.perClass ? Number(course.perClass) : null;
    } else if (paymentCycle === 'monthly') {
      amount = course.monthly ? Number(course.monthly) : null;
    } else if (paymentCycle === 'quarterly') {
      amount = course.quarterly ? Number(course.quarterly) : null;
    } else if (paymentCycle === 'halfYearly') {
      amount = course.halfYearly ? Number(course.halfYearly) : null;
    }

    if (amount === null || amount < 0) {
      return NextResponse.json(
        { message: `Course does not have a valid ${paymentCycle} price configured` },
        { status: 400 },
      );
    }

    // Verify student exists and belongs to the tenant
    const student = await prisma.student.findFirst({
      where: { 
        id: studentId,
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        locationId: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found or access denied' },
        { status: 400 },
      );
    }

    if (!student.locationId) {
      return NextResponse.json(
        { message: 'Student does not have a location assigned' },
        { status: 400 },
      );
    }

    // Verify coach exists and belongs to the tenant (if provided)
    if (coachId) {
      const coach = await prisma.employee.findFirst({
        where: { 
          id: coachId,
          tenantId: tenantContext.tenantId,
        },
        select: {
          id: true,
          tenantId: true,
          role: true,
        },
      });

      if (!coach) {
        return NextResponse.json(
          { message: 'Coach not found or access denied' },
          { status: 400 },
        );
      }
    }

    // At least one day should have a time
    const hasTime = monday || tuesday || wednesday || thursday || friday || saturday || sunday;
    if (!hasTime) {
      return NextResponse.json(
        { message: 'At least one day of the week must have a time' },
        { status: 400 },
      );
    }

    const newBatch = await prisma.batch.create({
      data: {
        tenantId: tenantContext.tenantId!,
        programId,
        courseId,
        locationId: student.locationId,
        studentId,
        paymentCycle: paymentCycle,
        amount: amount,
        monday: monday || null,
        tuesday: tuesday || null,
        wednesday: wednesday || null,
        thursday: thursday || null,
        friday: friday || null,
        saturday: saturday || null,
        sunday: sunday || null,
        coachId: coachId || null,
        isActive,
        createdBy: tenantContext.user.id,
      } as any,
    });

    // Ensure student record reflects the selected course
    await prisma.student.update({
      where: { id: studentId },
      data: { courseId },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newBatch.id),
      entityType: 'batch',
      description: 'Batch added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(newBatch));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
