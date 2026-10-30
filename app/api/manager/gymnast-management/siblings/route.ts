import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: unknown) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch only students who have siblings (manager location scoped)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const rawStatus = searchParams.get('status');
  const status = rawStatus ? rawStatus.trim() : null;
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantContext.tenantId || !tenantContext.locationId) {
      return NextResponse.json(
        { message: 'Tenant and location context required' },
        { status: 400 },
      );
    }

    const tenantId = tenantContext.tenantId;
    const locationId = tenantContext.locationId;

    // Find all student IDs that have siblings at this location
    const allStudentGuardians = await prisma.studentGuardian.findMany({
      where: {
        student: {
          tenantId,
          locationId,
        },
      },
      select: {
        studentId: true,
        guardianId: true,
      },
    });

    // Group by guardianId to find guardians with multiple students
    const guardianStudentMap = new Map<bigint, bigint[]>();
    allStudentGuardians.forEach((sg) => {
      const existing = guardianStudentMap.get(sg.guardianId) || [];
      existing.push(sg.studentId);
      guardianStudentMap.set(sg.guardianId, existing);
    });

    // Get all student IDs that have siblings (guardian linked to > 1 student)
    const studentIdsWithSiblings = new Set<bigint>();
    guardianStudentMap.forEach((studentIds) => {
      if (studentIds.length > 1) {
        studentIds.forEach((studentId) => studentIdsWithSiblings.add(studentId));
      }
    });

    if (studentIdsWithSiblings.size === 0) {
      return NextResponse.json(
        jsonBigInt({
          data: [],
          pagination: {
            total: 0,
            page,
            limit,
            hasNext: false,
            hasPrev: false,
          },
        }),
      );
    }

    // Build where clause
    const whereClause: {
      AND: Array<Record<string, unknown>>;
    } = {
      AND: [
        { tenantId, locationId },
        {
          id: {
            in: Array.from(studentIdsWithSiblings),
          },
        },
      ],
    };

    if (query) {
      whereClause.AND.push({
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { registrationNo: { contains: query } },
        ],
      });
    }

    if (status && ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      whereClause.AND.push({ status });
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
        team: true,
        skilllevelName: true,
      },
    });

    const teamIds = students.map((s) => s.team).filter((id): id is string => !!id);
    const teamMap = new Map<string, string>();

    if (teamIds.length > 0) {
      const uniqueTeamIds = Array.from(new Set(teamIds));
      const teams = await prisma.team.findMany({
        where: {
          id: { in: uniqueTeamIds.map((id) => parseInt(id, 10)) },
          tenantId,
        },
        select: { id: true, name: true },
      });
      teams.forEach((team) => teamMap.set(String(team.id), team.name));
    }

    const studentsWithNames = students.map((student) => ({
      ...student,
      teamName: student.team ? teamMap.get(student.team) || null : null,
      skillLevelName: student.skilllevelName || null,
    }));

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
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
