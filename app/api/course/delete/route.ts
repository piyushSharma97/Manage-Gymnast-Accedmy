import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete courses
export async function DELETE(request: NextRequest) {
  try {
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
    const body = await request.json();

    const courseIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (courseIds.length === 0) {
      return NextResponse.json(
        { message: 'No course IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = courseIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== courseIds.length) {
      return NextResponse.json(
        { message: 'Invalid course IDs provided' },
        { status: 400 },
      );
    }

    // Check if any courses are being used by batches
    const batchesCount = await prisma.batch.count({
      where: { 
        courseId: { 
          in: validIds 
        } 
      },
    });

    if (batchesCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete courses that have associated batches' },
        { status: 400 },
      );
    }

    // Check if any courses are being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { 
        courseId: { 
          in: validIds 
        } 
      },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete courses that have associated enrollments' },
        { status: 400 },
      );
    }

    // Get course details for logging (only for courses belonging to the tenant)
    const coursesToDelete = await prisma.course.findMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        courseName: true,
        courseCode: true,
      },
    });

    if (coursesToDelete.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some courses not found or access denied' },
        { status: 400 },
      );
    }

    // Delete the courses
    const deleteResult = await prisma.course.deleteMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
    });

    // Log the deletion
    for (const course of coursesToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(course.id),
        entityType: 'course',
        description: `Course deleted: ${course.courseName} (${course.courseCode})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} course(s) deleted successfully`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
