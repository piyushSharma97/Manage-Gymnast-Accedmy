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

// GET: Fetch all students across all tenants (owner only)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const rawStatus = searchParams.get('status');
  const status = rawStatus ? rawStatus.trim() : null;
  const tenantId = searchParams.get('tenantId');
  const locationId = searchParams.get('locationId');
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const whereClause: any = {
      AND: [],
    };

    // Add search query filter
    if (query) {
      whereClause.AND.push({
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { registrationNo: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    // Add tenant filter if provided
    if (tenantId) {
      const tenantIdNum = parseInt(tenantId);
      if (!isNaN(tenantIdNum)) {
        whereClause.AND.push({ tenantId: tenantIdNum });
      }
    }

    // Add location filter if provided
    if (locationId) {
      const locationIdNum = parseInt(locationId);
      if (!isNaN(locationIdNum)) {
        whereClause.AND.push({ locationId: locationIdNum });
      }
    }

    // Add status filter if provided
    if (status && ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      whereClause.AND.push({ status });
    }

    // If no AND conditions, remove the AND wrapper
    if (whereClause.AND.length === 0) {
      delete whereClause.AND;
    }

    const total = await prisma.student.count({ where: whereClause });

    const students = await prisma.student.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDirection },
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        status: true,
        joinDate: true,
        createdAt: true,
        tenantId: true,
        locationId: true,
        skilllevelName: true,
        team: true,
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
    });

    // Map students with tenant name
    // Note: skilllevelName is selected, so it should be available on the student object
    const studentsWithNames = students.map(student => {
      return {
        id: student.id,
        registrationNo: student.registrationNo,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phone: student.phone,
        gender: student.gender,
        status: student.status,
        joinDate: student.joinDate,
        createdAt: student.createdAt,
        tenantId: student.tenantId,
        locationId: student.locationId,
        tenantName: student.tenant?.academyName || null,
        // Access skilllevelName from the selected fields
        skillLevelName: (student as any).skilllevelName ?? null,
        teamName: student.team ?? null,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        data: studentsWithNames,
        pagination: {
          total,
          page,
          limit,
          hasNext: skip + students.length < total,
          hasPrev: page > 1,
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

