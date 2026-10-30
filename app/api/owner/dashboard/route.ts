import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch owner dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    // Get counts for all entities across all tenants
    const [academiesCount, locationsCount, studentsCount, staffCount] = await Promise.all([
      // Count of active academies (tenants)
      prisma.tenant.count({
        where: {
          isActive: true,
        },
      }),
      // Count of active locations
      prisma.location.count({
        where: {
          isActive: true,
        },
      }),
      // Count of all students (across all tenants)
      prisma.student.count(),
      // Count of active staff (employees)
      prisma.employee.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    return NextResponse.json(
      jsonBigInt({
        stats: {
          academies: academiesCount,
          locations: locationsCount,
          students: studentsCount,
          staff: staffCount,
        },
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

