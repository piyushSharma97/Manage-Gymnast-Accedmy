import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch students who have paid fees with filters
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'lastFeesDate';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const locationId = searchParams.get('locationId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
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

    // Build where clause for payments
    const paymentWhereClause: any = {
      tenantId: tenantContext.tenantId,
    };

    if (locationId) {
      paymentWhereClause.locationId = parseInt(locationId);
    }

    if (startDate || endDate) {
      paymentWhereClause.receivedAt = {};
      if (startDate) {
        paymentWhereClause.receivedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
        paymentWhereClause.receivedAt.lte = endDateObj;
      }
    }

    // Get all payments matching the filters
    const payments = await prisma.payment.findMany({
      where: paymentWhereClause,
      include: {
        student: {
          select: {
            id: true,
            registrationNo: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    // Fetch course information for payments
    const courseIds = payments.map((p: any) => p.courseId).filter((id: number) => id);
    const courses = courseIds.length > 0
      ? await prisma.course.findMany({
          where: {
            id: { in: courseIds },
            tenantId: tenantContext.tenantId,
          },
          select: {
            id: true,
            courseName: true,
          },
        })
      : [];

    const courseMap = new Map(courses.map((c: any) => [c.id, c]));

    // Group payments by student and get the latest payment for each student
    const studentPaymentMap = new Map<string, any>();

    payments.forEach((payment: any) => {
      const studentId = String(payment.studentId);
      const existing = studentPaymentMap.get(studentId);
      const course = payment.courseId ? courseMap.get(payment.courseId) : null;

      if (!existing || new Date(payment.receivedAt) > new Date(existing.lastPaymentDate)) {
        studentPaymentMap.set(studentId, {
          studentId: studentId,
          registrationNo: payment.student.registrationNo,
          firstName: payment.student.firstName,
          lastName: payment.student.lastName,
          phone: payment.student.phone,
          courseId: payment.courseId,
          courseName: course?.courseName || null,
          locationId: payment.locationId,
          locationName: payment.location.centerName,
          lastFeesPaid: Number(payment.amountPaid),
          lastFeesDate: payment.receivedAt,
        });
      }
    });

    // Convert map to array
    let students = Array.from(studentPaymentMap.values());

    // Apply search query filter
    if (query) {
      const queryLower = query.toLowerCase();
      students = students.filter((student) => {
        return (
          student.registrationNo?.toLowerCase().includes(queryLower) ||
          student.firstName?.toLowerCase().includes(queryLower) ||
          student.lastName?.toLowerCase().includes(queryLower) ||
          student.phone?.includes(query) ||
          student.courseName?.toLowerCase().includes(queryLower)
        );
      });
    }

    // Apply location filter if provided (for students list)
    if (locationId) {
      students = students.filter((student) => student.locationId === parseInt(locationId));
    }

    // Sort the results
    students.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'registrationNo':
          aValue = a.registrationNo || '';
          bValue = b.registrationNo || '';
          break;
        case 'firstName':
          aValue = a.firstName || '';
          bValue = b.firstName || '';
          break;
        case 'name':
          aValue = `${a.firstName || ''} ${a.lastName || ''}`.trim();
          bValue = `${b.firstName || ''} ${b.lastName || ''}`.trim();
          break;
        case 'courseName':
          aValue = a.courseName || '';
          bValue = b.courseName || '';
          break;
        case 'phone':
          aValue = a.phone || '';
          bValue = b.phone || '';
          break;
        case 'lastFeesPaid':
          aValue = a.lastFeesPaid || 0;
          bValue = b.lastFeesPaid || 0;
          break;
        case 'lastFeesDate':
        default:
          aValue = a.lastFeesDate ? new Date(a.lastFeesDate).getTime() : 0;
          bValue = b.lastFeesDate ? new Date(b.lastFeesDate).getTime() : 0;
          break;
      }

      if (sortDirection === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    // Get total count before pagination
    const total = students.length;

    // Apply pagination
    const paginatedStudents = students.slice(skip, skip + limit);

    return NextResponse.json(
      jsonBigInt({
        data: paginatedStudents,
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

