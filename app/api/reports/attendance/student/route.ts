import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch all attendance records for a specific student
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const sortField = searchParams.get('sort') || 'sessionDate';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
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

    // Check if user has permission to view reports
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { message: 'Student ID is required' },
        { status: 400 },
      );
    }

    // Build where clause for attendance
    const attendanceWhereClause: any = {
      tenantId: tenantContext.tenantId,
      studentId: BigInt(studentId),
    };

    // Count total records
    const total = await prisma.attendance.count({
      where: attendanceWhereClause,
    });

    // Fetch attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: attendanceWhereClause,
      skip,
      take: limit,
      orderBy: {
        [sortField]: sortDirection,
      } as any,
      include: {
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
    });

    // Fetch student details
    const student = await prisma.student.findFirst({
      where: {
        id: BigInt(studentId),
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        phone: true,
        courseId: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    // Fetch course information if available
    let courseName = null;
    if (student.courseId) {
      const course = await prisma.course.findFirst({
        where: {
          id: student.courseId,
          tenantId: tenantContext.tenantId,
        },
        select: {
          courseName: true,
        },
      });
      courseName = course?.courseName || null;
    }

    // Format attendance records
    const formattedRecords = attendanceRecords.map((record: any) => ({
      id: String(record.id),
      sessionDate: record.sessionDate,
      locationName: record.location.centerName,
      createdAt: record.createdAt,
    }));

    return NextResponse.json(
      jsonBigInt({
        data: formattedRecords,
        student: {
          id: String(student.id),
          registrationNo: student.registrationNo,
          firstName: student.firstName,
          lastName: student.lastName,
          phone: student.phone,
          courseName: courseName,
        },
        pagination: {
          total,
          page,
        },
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

