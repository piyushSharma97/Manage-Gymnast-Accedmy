import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';
import { fetchStudentIdsWithFitnessSkill } from '@/lib/fitness-result-raw';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

function calculateAge(dob: Date | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const FITNESS_ASSESSMENT_EVENT_TYPE = 'fitness-assessment';

// GET: Fetch students who participated in fitness-assessment events
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const sortField = searchParams.get('sort') || 'firstName';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const eventId = searchParams.get('eventId');
  const level = searchParams.get('level');
  const fitnessSkillId = searchParams.get('fitnessSkillId');
  const query = searchParams.get('query') || '';
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request as NextRequest);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const tenantFilters = createTenantFilters(tenantContext);

    const whereClause: any = {
      event: {
        tenantId: tenantContext.tenantId,
        event_type: FITNESS_ASSESSMENT_EVENT_TYPE,
      },
      student: {
        tenantId: tenantContext.tenantId,
      },
    };

    if (tenantFilters.locationId) {
      whereClause.student.locationId = tenantFilters.locationId;
    }
    if (eventId) {
      whereClause.eventid = parseInt(eventId, 10);
    }
    if (level) {
      whereClause.OR = [
        { level: { contains: level } },
        { student: { skilllevelName: { contains: level } } },
      ];
    }

    const tenantId = tenantContext.tenantId;
    if (fitnessSkillId && tenantId !== undefined) {
      const studentIdsFromScores = await fetchStudentIdsWithFitnessSkill(
        prisma,
        tenantId,
        parseInt(fitnessSkillId, 10),
        eventId ? parseInt(eventId, 10) : undefined,
      );
      if (studentIdsFromScores.length === 0) {
        return NextResponse.json(
          jsonBigInt({
            data: [],
            pagination: { total: 0, page, limit, hasNext: false, hasPrev: false },
          }),
        );
      }
      whereClause.studentId = { in: studentIdsFromScores.map((id) => BigInt(id)) };
    }

    if (query) {
      whereClause.AND = whereClause.AND || [];
      whereClause.AND.push({
        OR: [
          { student: { firstName: { contains: query } } },
          { student: { lastName: { contains: query } } },
          { student: { registrationNo: { contains: query } } },
          { student: { email: { contains: query } } },
        ],
      });
    }

    const total = await prisma.studentEventFee.count({
      where: whereClause,
    });

    let orderBy: any = { id: sortDirection };
    if (sortField === 'name' || sortField === 'firstName') {
      orderBy = { student: { firstName: sortDirection } };
    } else if (sortField === 'lastName') {
      orderBy = { student: { lastName: sortDirection } };
    } else if (sortField === 'dob') {
      orderBy = { student: { dob: sortDirection } };
    } else if (sortField === 'gender') {
      orderBy = { student: { gender: sortDirection } };
    } else if (sortField === 'email') {
      orderBy = { student: { email: sortDirection } };
    } else if (sortField === 'phone') {
      orderBy = { student: { phone: sortDirection } };
    }

    const studentEventFees = await prisma.studentEventFee.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy,
      include: {
        student: {
          select: {
            id: true,
            registrationNo: true,
            firstName: true,
            lastName: true,
            dob: true,
            gender: true,
            phone: true,
            email: true,
            team: true,
            skilllevelName: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            event_type: true,
            startdate: true,
          },
        },
      },
    });

    const teamIds = studentEventFees
      .map((sef) => sef.student.team)
      .filter((id): id is string => !!id);
    const teamMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const uniqueTeamIds = Array.from(new Set(teamIds));
      const teams = await prisma.team.findMany({
        where: {
          id: { in: uniqueTeamIds.map((id) => parseInt(id, 10)) },
          tenantId: tenantContext.tenantId,
        },
        select: { id: true, name: true },
      });
      teams.forEach((team) => {
        teamMap.set(String(team.id), team.name);
      });
    }

    const formattedData = studentEventFees.map((sef) => {
      const age = calculateAge(sef.student.dob);
      const groupName = sef.student.team
        ? teamMap.get(sef.student.team) || null
        : null;
      const studentLevel = sef.level || sef.student.skilllevelName || null;
      return {
        id: String(sef.id),
        studentId: String(sef.studentId),
        name: `${sef.student.firstName} ${sef.student.lastName || ''}`.trim(),
        dob: sef.student.dob,
        age,
        gender: sef.student.gender,
        phone: sef.student.phone,
        email: sef.student.email,
        group: groupName,
        level: studentLevel,
        comments: sef.Comments || null,
        result: null,
        height: sef.height ?? null,
        weight: sef.weight ?? null,
        eventId: sef.eventid,
        eventName: sef.event.name,
        eventDate: sef.event.startdate,
        registrationNo: sef.student.registrationNo,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        data: formattedData,
        pagination: {
          total,
          page,
          limit,
          hasNext: skip + formattedData.length < total,
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
