import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch all courses
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const programId = searchParams.get('programId');
  const sportCategoryId = searchParams.get('sportCategoryId');
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

    // Check if user has permission to view courses
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
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
        {
          OR: [
            {
              courseName: {
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

    if (programId) {
      whereClause.AND.push({ programId: parseInt(programId) });
    }

    if (sportCategoryId) {
      whereClause.AND.push({ sportCategoryId: parseInt(sportCategoryId) });
    }

    // Count total records matching the filter
    const total = await prisma.course.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.course.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    const courses =
      total > 0
        ? await prisma.course.findMany({
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
              tenant: {
                select: {
                  id: true,
                  academyName: true,
                },
              },
            },
          })
        : [];

    return NextResponse.json({
      data: courses,
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

// POST: Add a new course
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

    // Check if user has permission to create courses
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const programId = typeof body?.programId === 'number' ? body.programId : null;
    const courseName = typeof body?.courseName === 'string' ? body.courseName.trim() : '';
    const sportCategoryId = typeof body?.sportCategoryId === 'number' ? body.sportCategoryId : null;
    const classFrequency = typeof body?.classFrequency === 'number' ? body.classFrequency : 0;
    const perClass = typeof body?.perClass === 'number' ? body.perClass : 0;
    const monthly = typeof body?.monthly === 'number' ? body.monthly : 0;
    const quarterly = typeof body?.quarterly === 'number' ? body.quarterly : 0;
    const halfYearly = typeof body?.halfYearly === 'number' ? body.halfYearly : 0;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    if (!programId || programId <= 0) {
      return NextResponse.json(
        { message: 'Invalid programId' },
        { status: 400 },
      );
    }

    if (!courseName || courseName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid courseName' },
        { status: 400 },
      );
    }

    if (!sportCategoryId || sportCategoryId <= 0) {
      return NextResponse.json(
        { message: 'Invalid sportCategoryId' },
        { status: 400 },
      );
    }

    if (classFrequency <= 0) {
      return NextResponse.json(
        { message: 'Invalid classFrequency' },
        { status: 400 },
      );
    }

    if (perClass < 0) {
      return NextResponse.json(
        { message: 'Invalid perClass amount' },
        { status: 400 },
      );
    }

    if (monthly < 0) {
      return NextResponse.json(
        { message: 'Invalid monthly amount' },
        { status: 400 },
      );
    }

    if (quarterly < 0) {
      return NextResponse.json(
        { message: 'Invalid quarterly amount' },
        { status: 400 },
      );
    }

    if (halfYearly < 0) {
      return NextResponse.json(
        { message: 'Invalid halfYearly amount' },
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

    // Verify sports category exists
    const sportsCategory = await prisma.sportsCategory.findUnique({
      where: { id: sportCategoryId },
    });

    if (!sportsCategory) {
      return NextResponse.json(
        { message: 'Sports category not found' },
        { status: 400 },
      );
    }

    // Ensure the course name is unique within the program
    const uniqueName = await isUnique('course', { 
      courseName, 
      programId,
      tenantId: tenantContext.tenantId,
    });
    if (!uniqueName) {
      return NextResponse.json(
        { message: 'Course name must be unique within the program' },
        { status: 400 },
      );
    }

    const newCourse = await prisma.course.create({
      data: {
        tenantId: tenantContext.tenantId!,
        programId,
        courseName,
        sportCategoryId,
        classFrequency,
        perClass,
        monthly,
        quarterly,
        halfYearly,
        isActive,
        createdBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newCourse.id),
      entityType: 'course',
      description: 'Course added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newCourse);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
