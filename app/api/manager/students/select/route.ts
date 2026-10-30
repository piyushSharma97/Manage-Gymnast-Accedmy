import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch students for select/dropdown
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const status = searchParams.get('status');
  const locationId = searchParams.get('locationId');
  const withBatches = searchParams.get('withBatches') === 'true';

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const whereClause: any = {
      tenantId: tenantContext.tenantId,
      ...(query && {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { registrationNo: { contains: query, mode: 'insensitive' } },
        ],
      }),
    };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (locationId) {
      const locationIdNum = parseInt(locationId);
      if (!isNaN(locationIdNum)) {
        whereClause.locationId = locationIdNum;
      }
    }

    // If withBatches is true, filter students who have batches
    if (withBatches) {
      // First, get all unique student IDs that have batches
      const batches = await prisma.batch.findMany({
        where: {
          tenantId: tenantContext.tenantId,
          isActive: true,
        },
        select: {
          studentId: true,
        },
      });

      // Get unique student IDs
      const studentIdsSet = new Set<bigint>();
      batches.forEach(batch => {
        studentIdsSet.add(batch.studentId);
      });
      const studentIds = Array.from(studentIdsSet);
      
      if (studentIds.length === 0) {
        return NextResponse.json(jsonBigInt([]));
      }

      whereClause.id = { in: studentIds };
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        courseId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return NextResponse.json(jsonBigInt(students));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}


