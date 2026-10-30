import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific course by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
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

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid course ID' },
        { status: 400 },
      );
    }

    const course = await prisma.course.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
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
    });

    if (!course) {
      return NextResponse.json(
        { message: 'Course not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(course);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to update courses
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid course ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const programId = typeof body?.programId === 'number' ? body.programId : null;
    const courseName = typeof body?.courseName === 'string' ? body.courseName.trim() : '';
    const courseCode = typeof body?.courseCode === 'string' ? body.courseCode.trim() : '';
    const sportCategoryId = typeof body?.sportCategoryId === 'number' ? body.sportCategoryId : null;
    const classFrequency = typeof body?.classFrequency === 'number' ? body.classFrequency : null;
    const paymentCycle = typeof body?.paymentCycle === 'string' ? body.paymentCycle.trim() : '';
    const amount = typeof body?.amount === 'number' ? body.amount : null;
    const shortDescription = typeof body?.shortDescription === 'string' ? body.shortDescription.trim() : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;

    // Check if course exists and belongs to tenant
    const existingCourse = await prisma.course.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { message: 'Course not found' },
        { status: 404 },
      );
    }

    if (programId && programId <= 0) {
      return NextResponse.json(
        { message: 'Invalid programId' },
        { status: 400 },
      );
    }

    if (courseName && courseName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid courseName' },
        { status: 400 },
      );
    }

    if (courseCode && courseCode.length > 20) {
      return NextResponse.json(
        { message: 'Invalid courseCode' },
        { status: 400 },
      );
    }

    if (sportCategoryId && sportCategoryId <= 0) {
      return NextResponse.json(
        { message: 'Invalid sportCategoryId' },
        { status: 400 },
      );
    }

    if (classFrequency !== null && classFrequency <= 0) {
      return NextResponse.json(
        { message: 'Invalid classFrequency' },
        { status: 400 },
      );
    }

    if (paymentCycle && paymentCycle.length > 50) {
      return NextResponse.json(
        { message: 'Invalid paymentCycle' },
        { status: 400 },
      );
    }

    if (amount !== null && amount < 0) {
      return NextResponse.json(
        { message: 'Invalid amount' },
        { status: 400 },
      );
    }

    // If programId is provided, verify program exists and belongs to tenant
    if (programId) {
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
    }

    // If sportCategoryId is provided, verify sports category exists
    if (sportCategoryId) {
      const sportsCategory = await prisma.sportsCategory.findUnique({
        where: { id: sportCategoryId },
      });

      if (!sportsCategory) {
        return NextResponse.json(
          { message: 'Sports category not found' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for course name if provided and different from current
    if (courseName && courseName !== existingCourse.courseName) {
      const uniqueName = await isUnique('course', { 
        courseName, 
        programId: programId || existingCourse.programId,
        tenantId: tenantContext.tenantId,
      });
      if (!uniqueName) {
        return NextResponse.json(
          { message: 'Course name must be unique within the program' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness for course code if provided and different from current
    if (courseCode && courseCode !== existingCourse.courseCode) {
      const uniqueCode = await isUnique('course', { 
        courseCode, 
        programId: programId || existingCourse.programId,
        tenantId: tenantContext.tenantId,
      });
      if (!uniqueCode) {
        return NextResponse.json(
          { message: 'Course code must be unique within the program' },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (programId !== null) updateData.programId = programId;
    if (courseName) updateData.courseName = courseName;
    if (courseCode) updateData.courseCode = courseCode;
    if (sportCategoryId !== null) updateData.sportCategoryId = sportCategoryId;
    if (classFrequency !== null) updateData.classFrequency = classFrequency;
    if (paymentCycle) updateData.paymentCycle = paymentCycle;
    if (amount !== null) updateData.amount = amount;
    if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
    if (isActive !== null) updateData.isActive = isActive;
    updateData.updatedBy = tenantContext.user.id;

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
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
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedCourse.id),
      entityType: 'course',
      description: 'Course updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedCourse);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete courses
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid course ID' },
        { status: 400 },
      );
    }

    // Check if course exists and belongs to tenant
    const existingCourse = await prisma.course.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { message: 'Course not found' },
        { status: 404 },
      );
    }

    // Check if course is being used by batches
    const batchesCount = await prisma.batch.count({
      where: { courseId: id },
    });

    if (batchesCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete course that has associated batches' },
        { status: 400 },
      );
    }

    // Check if course is being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { courseId: id },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete course that has associated enrollments' },
        { status: 400 },
      );
    }

    await prisma.course.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'course',
      description: 'Course deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Course deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
