import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getCoachAllowedStudentSkillLevelValues } from '@/lib/api/coach-student-skill-filter';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch all students (paginated, filtered, sorted) - Read-only for coach
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const rawStatus = searchParams.get('status');
  const locationId = searchParams.get('locationId');
  const status = rawStatus ? rawStatus.trim() : null;
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.isCoach && !tenantContext.isManager && !tenantContext.isAdmin && !tenantContext.isOwner) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const whereClause: any = {
      AND: [
        { tenantId: tenantContext.tenantId },
        {locationId:  Number(locationId) },
        {
          OR: [
            { firstName: { contains: query } },
            { lastName: { contains: query } },
            { email: { contains: query } },
            { registrationNo: { contains: query } },
          ],
        },
      ],
    };

    // For coaches, always filter to show only active students
    if (tenantContext.isCoach && !tenantContext.isManager && !tenantContext.isAdmin && !tenantContext.isOwner) {
      whereClause.AND.push({ status: 'ACTIVE' });
    } else if (status && ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      // For managers/admins/owners, allow status filter
      whereClause.AND.push({ status });
    }

    const coachSkillValues = await getCoachAllowedStudentSkillLevelValues(tenantContext);
    if (coachSkillValues !== null) {
      if (coachSkillValues.length === 0) {
        whereClause.AND.push({ id: { in: [] } });
      } else {
        whereClause.AND.push({ skilllevelName: { in: coachSkillValues } });
      }
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

    // Fetch team names for lookup
    const teamIds = students.map(s => s.team).filter((id): id is string => !!id);

    // Create lookup map for teams
    const teamMap = new Map<string, string>();

    if (teamIds.length > 0) {
      const uniqueTeamIds = Array.from(new Set(teamIds));
      const teams = await prisma.team.findMany({
        where: {
          id: { in: uniqueTeamIds.map(id => parseInt(id, 10)) },
          tenantId: tenantContext.tenantId,
        },
        select: {
          id: true,
          name: true,
        },
      });
      teams.forEach(team => {
        teamMap.set(String(team.id), team.name);
      });
    }

    // Map team and skill level names to students
    const studentsWithNames = students.map(student => ({
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
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

 