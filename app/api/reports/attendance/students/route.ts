import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch students who attended classes in a specific month with payment and invoice info
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'registrationNo';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const locationId = searchParams.get('locationId');
  const billingMonth = searchParams.get('billingMonth'); // Format: YYYY-MM
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

    // Calculate date range for attendance (previous month by default, or specified billing month)
    let firstDayOfMonth: Date;
    let lastDayOfMonth: Date;
    let billingMonthDate: Date;

    if (billingMonth) {
      // Parse billing month (YYYY-MM format)
      const [year, month] = billingMonth.split('-').map(Number);
      firstDayOfMonth = new Date(year, month - 1, 1);
      lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      billingMonthDate = new Date(year, month - 1, 1);
    } else {
      // Default to previous month
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() - 1;
      firstDayOfMonth = new Date(year, month, 1);
      lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      billingMonthDate = new Date(year, month, 1);
    }

    // Build where clause for attendance
    const attendanceWhereClause: any = {
      tenantId: tenantContext.tenantId,
      sessionDate: {
        gte: firstDayOfMonth,
        lte: lastDayOfMonth,
      },
    };

    if (locationId) {
      attendanceWhereClause.locationId = parseInt(locationId);
    }

    // Get all attendance records for the specified month (to count classes per student)
    const allAttendanceRecords = await prisma.attendance.findMany({
      where: attendanceWhereClause,
      select: {
        studentId: true,
        locationId: true,
      },
    });

    if (allAttendanceRecords.length === 0) {
      return NextResponse.json(
        jsonBigInt({
          data: [],
          pagination: {
            total: 0,
            page,
          },
        })
      );
    }

    // Count attendance per student
    const attendanceCountMap = new Map<string, number>();
    allAttendanceRecords.forEach((record: any) => {
      const studentId = String(record.studentId);
      attendanceCountMap.set(studentId, (attendanceCountMap.get(studentId) || 0) + 1);
    });

    // Get unique student IDs
    const studentIds = Array.from(new Set(allAttendanceRecords.map((a: any) => a.studentId)));

    // Fetch student details
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        phone: true,
        courseId: true,
        locationId: true,
      },
    });

    // Fetch course information
    const courseIds = students.map((s: any) => s.courseId).filter((id: number) => id);
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

    // Fetch payments made in the billing month for each student
    const paymentsInMonth = await prisma.payment.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId: tenantContext.tenantId,
        receivedAt: {
          gte: new Date(billingMonthDate.getFullYear(), billingMonthDate.getMonth(), 1),
          lt: new Date(billingMonthDate.getFullYear(), billingMonthDate.getMonth() + 1, 1),
        },
      },
      select: {
        studentId: true,
        amountPaid: true,
        receivedAt: true,
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });

    // Group payments by student - sum amounts and get latest payment date in that month
    const studentPaymentMap = new Map<string, any>();
    paymentsInMonth.forEach((payment: any) => {
      const studentId = String(payment.studentId);
      const existing = studentPaymentMap.get(studentId);
      if (existing) {
        // Sum the amounts and keep the latest date
        existing.feesPaidInMonth = existing.feesPaidInMonth + Number(payment.amountPaid);
        if (new Date(payment.receivedAt) > new Date(existing.feesPaidDateInMonth)) {
          existing.feesPaidDateInMonth = payment.receivedAt;
        }
      } else {
        studentPaymentMap.set(studentId, {
          feesPaidInMonth: Number(payment.amountPaid),
          feesPaidDateInMonth: payment.receivedAt,
        });
      }
    });

    // Fetch invoices for the billing month
    const invoices = await prisma.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId: tenantContext.tenantId,
        billingMonth: {
          gte: new Date(billingMonthDate.getFullYear(), billingMonthDate.getMonth(), 1),
          lt: new Date(billingMonthDate.getFullYear(), billingMonthDate.getMonth() + 1, 1),
        },
      } as any,
      select: {
        studentId: true,
        invoiceno: true,
      } as any,
    });

    // Create invoice map by student ID
    const invoiceMap = new Map<string, string>();
    invoices.forEach((invoice: any) => {
      const studentId = String(invoice.studentId);
      invoiceMap.set(studentId, invoice.invoiceno);
    });

    // Build the report data
    let reportData = students.map((student: any) => {
      const studentId = String(student.id);
      const payment = studentPaymentMap.get(studentId);
      const course = student.courseId ? courseMap.get(student.courseId) : null;
      const invoiceNo = invoiceMap.get(studentId);
      const classesAttended = attendanceCountMap.get(studentId) || 0;

      return {
        studentId: studentId,
        registrationNo: student.registrationNo,
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        courseId: student.courseId,
        courseName: course?.courseName || null,
        locationId: student.locationId,
        classesAttended: classesAttended,
        feesPaidInMonth: payment?.feesPaidInMonth || null,
        feesPaidDateInMonth: payment?.feesPaidDateInMonth || null,
        invoiceNumber: invoiceNo || null,
      };
    });

    // Apply search query filter
    if (query) {
      const queryLower = query.toLowerCase();
      reportData = reportData.filter((student) => {
        return (
          student.registrationNo?.toLowerCase().includes(queryLower) ||
          student.firstName?.toLowerCase().includes(queryLower) ||
          student.lastName?.toLowerCase().includes(queryLower) ||
          student.phone?.includes(query) ||
          student.courseName?.toLowerCase().includes(queryLower) ||
          student.invoiceNumber?.toLowerCase().includes(queryLower) ||
          String(student.classesAttended || 0).includes(query)
        );
      });
    }

    // Apply location filter if provided
    if (locationId) {
      reportData = reportData.filter((student) => student.locationId === parseInt(locationId));
    }

    // Sort the results
    reportData.sort((a, b) => {
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
        case 'classesAttended':
          aValue = a.classesAttended || 0;
          bValue = b.classesAttended || 0;
          break;
        case 'feesPaidInMonth':
          aValue = a.feesPaidInMonth || 0;
          bValue = b.feesPaidInMonth || 0;
          break;
        case 'feesPaidDateInMonth':
          aValue = a.feesPaidDateInMonth ? new Date(a.feesPaidDateInMonth).getTime() : 0;
          bValue = b.feesPaidDateInMonth ? new Date(b.feesPaidDateInMonth).getTime() : 0;
          break;
        case 'invoiceNumber':
          aValue = a.invoiceNumber || '';
          bValue = b.invoiceNumber || '';
          break;
        default:
          aValue = a.registrationNo || '';
          bValue = b.registrationNo || '';
          break;
      }

      if (sortDirection === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    // Get total count before pagination
    const total = reportData.length;

    // Apply pagination
    const paginatedData = reportData.slice(skip, skip + limit);

    return NextResponse.json(
      jsonBigInt({
        data: paginatedData,
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

