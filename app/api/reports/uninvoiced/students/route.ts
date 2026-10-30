import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const requestedSortField = (searchParams.get('sort') ||
    'enrollmentStart') as string;
  const allowedSortFields = [
    'registrationNo',
    'name',
    'programName',
    'courseName',
    'locationName',
    'enrollmentStart',
  ] as const;
  type SortField = (typeof allowedSortFields)[number];
  const sortField: SortField = allowedSortFields.includes(
    requestedSortField as SortField,
  )
    ? (requestedSortField as SortField)
    : 'enrollmentStart';
  const sortDirection = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const locationId = searchParams.get('locationId');
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request as NextRequest);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Build where clause for batches
    const batchWhereClause: any = {
      tenantId: tenantContext.tenantId,
      isActive: true,
    };

    // Fetch all active batches with program and course
    const batches = await prisma.batch.findMany({
      where: batchWhereClause,
      select: {
        id: true,
        studentId: true,
        programId: true,
        courseId: true,
        paymentCycle: true,
        createdAt: true,
        program: {
          select: {
            name: true,
          },
        },
        course: {
          select: {
            courseName: true,
          },
        },
      },
    });

    if (batches.length === 0) {
      return NextResponse.json(
        jsonBigInt({
          data: [],
          pagination: {
            total: 0,
            page,
          },
        }),
      );
    }

    // Get unique student IDs from batches
    const allStudentIds = Array.from(
      new Set(batches.map((batch) => batch.studentId)),
    );

    // Fetch students with location information
    const studentWhereClause: any = {
      id: { in: allStudentIds },
      tenantId: tenantContext.tenantId,
    };

    if (locationId) {
      studentWhereClause.locationId = parseInt(locationId, 10);
    }

    const students = await prisma.student.findMany({
      where: studentWhereClause,
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        phone: true,
        locationId: true,
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
    });

    // Create a map of studentId to student data
    const studentMap = new Map(
      students.map((student) => [student.id.toString(), student]),
    );

    // Filter batches to only include those with students (after location filter)
    const filteredBatches = batches.filter((batch) =>
      studentMap.has(batch.studentId.toString()),
    );

    if (filteredBatches.length === 0) {
      return NextResponse.json(
        jsonBigInt({
          data: [],
          pagination: {
            total: 0,
            page,
          },
        }),
      );
    }

    // Get student IDs and batch IDs from filtered batches
    const filteredStudentIds = Array.from(
      new Set(filteredBatches.map((batch) => batch.studentId)),
    );
    const batchIds = Array.from(
      new Set(filteredBatches.map((batch) => batch.id)),
    );

    // Fetch ALL invoices for these students (to check both conditions)
    const allInvoiceRecords =
      filteredStudentIds.length > 0
        ? await prisma.invoice.findMany({
            where: {
              tenantId: tenantContext.tenantId,
              studentId: { in: filteredStudentIds },
            },
            select: {
              studentId: true,
              batchId: true,
            },
          })
        : [];

    // Create a set of students who have any invoices at all
    const studentsWithInvoices = new Set(
      allInvoiceRecords.map((invoice) => invoice.studentId.toString()),
    );

    // Create a set of student-batch combinations that have invoices
    // Key format: "studentId-batchId" (only for invoices with batchId)
    const studentBatchInvoiceSet = new Set(
      allInvoiceRecords
        .filter((invoice) => invoice.batchId !== null && invoice.batchId !== undefined)
        .map(
          (invoice) =>
            `${invoice.studentId.toString()}-${invoice.batchId?.toString()}`,
        ),
    );

    // Filter batches that meet either condition:
    // 1. Student has no invoices at all, OR
    // 2. Student has invoices but not for this specific batch
    let reportData = filteredBatches
      .filter((batch) => {
        const studentIdStr = batch.studentId.toString();
        const batchIdStr = batch.id.toString();
        const key = `${studentIdStr}-${batchIdStr}`;

        // Condition 1: Student has no invoices at all
        const studentHasNoInvoices = !studentsWithInvoices.has(studentIdStr);

        // Condition 2: Student has invoices but not for this specific batch
        const studentHasInvoicesButNotForThisBatch =
          studentsWithInvoices.has(studentIdStr) &&
          !studentBatchInvoiceSet.has(key);

        return studentHasNoInvoices || studentHasInvoicesButNotForThisBatch;
      })
      .map((batch) => {
        const student = studentMap.get(batch.studentId.toString());
        return {
          enrollmentId: batch.id.toString(), // Using batchId for compatibility
          batchId: batch.id,
          studentId: batch.studentId.toString(),
          registrationNo: student?.registrationNo || '',
          firstName: student?.firstName || '',
          lastName: student?.lastName || '',
          phone: student?.phone || null,
          programName: batch.program?.name || null,
          courseName: batch.course?.courseName || null,
          locationId: student?.locationId || 0,
          locationName: student?.location?.centerName || '',
          enrollmentStart: batch.createdAt?.toISOString() || null,
          paymentCycle: batch.paymentCycle || null,
        };
      });

    if (query) {
      const queryLower = query.toLowerCase();
      reportData = reportData.filter((record) => {
        return (
          record.registrationNo.toLowerCase().includes(queryLower) ||
          `${record.firstName} ${record.lastName}`
            .trim()
            .toLowerCase()
            .includes(queryLower) ||
          (record.phone || '').includes(query) ||
          (record.programName || '').toLowerCase().includes(queryLower) ||
          (record.courseName || '').toLowerCase().includes(queryLower) ||
          (record.locationName || '').toLowerCase().includes(queryLower)
        );
      });
    }

    const compareValues = (a: any, b: any) => {
      if (a === b) return 0;
      if (a === null || a === undefined) return -1;
      if (b === null || b === undefined) return 1;
      if (typeof a === 'string' && typeof b === 'string') {
        return a.localeCompare(b);
      }
      return a > b ? 1 : -1;
    };

    reportData.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'registrationNo':
          aValue = a.registrationNo;
          bValue = b.registrationNo;
          break;
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
          break;
        case 'programName':
          aValue = (a.programName || '').toLowerCase();
          bValue = (b.programName || '').toLowerCase();
          break;
        case 'courseName':
          aValue = (a.courseName || '').toLowerCase();
          bValue = (b.courseName || '').toLowerCase();
          break;
        case 'locationName':
          aValue = (a.locationName || '').toLowerCase();
          bValue = (b.locationName || '').toLowerCase();
          break;
        case 'enrollmentStart':
        default:
          aValue = a.enrollmentStart
            ? new Date(a.enrollmentStart).getTime()
            : 0;
          bValue = b.enrollmentStart
            ? new Date(b.enrollmentStart).getTime()
            : 0;
          break;
      }

      const result = compareValues(aValue, bValue);
      return sortDirection === 'desc' ? -result : result;
    });

    const total = reportData.length;
    const paginatedData = reportData.slice(skip, skip + limit);

    return NextResponse.json(
      jsonBigInt({
        data: paginatedData,
        pagination: {
          total,
          page,
        },
      }),
    );
  } catch (error: any) {
    console.error('Uninvoiced students report error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}


