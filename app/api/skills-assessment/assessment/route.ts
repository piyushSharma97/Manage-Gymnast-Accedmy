import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// Helper function to calculate age from date of birth
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

// GET: Fetch students who participated in Assessment events
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const sortField = searchParams.get('sort') || 'firstName';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const eventId = searchParams.get('eventId');
  const apparatusId = searchParams.get('apparatusId');
  const skillId = searchParams.get('skillId');
  const level = searchParams.get('level');
  const query = searchParams.get('query') || '';
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

    // Check if user has permission (admin, manager, or coach)
    if (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Create tenant-aware filters
    const tenantFilters = createTenantFilters(tenantContext);

    // Build where clause for StudentEventFee
    const whereClause: any = {
      event: {
        tenantId: tenantContext.tenantId,
        event_type: {
          contains: 'Assessment',
        },
      },
      student: {
        tenantId: tenantContext.tenantId,
      },
    };

    // Apply location filter if manager
    if (tenantFilters.locationId) {
      whereClause.student.locationId = tenantFilters.locationId;
    }

    // Filter by event
    if (eventId) {
      whereClause.eventid = parseInt(eventId, 10);
    }

    // Filter by level (from StudentEventFee.level or student.skilllevelName)
    if (level) {
      whereClause.OR = [
        { level: { contains: level } },
        { student: { skilllevelName: { contains: level } } },
      ];
    }

    // Filter by apparatus and/or skill (via AssessmentScore - students who have scores)
    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 403 },
      );
    }
    if (apparatusId || skillId) {
      const scoreWhere: {
        tenantId: number;
        skillId?: number;
        eventId?: number;
        skill?: { apparatus_id: number };
      } = {
        tenantId,
      };
      if (apparatusId && skillId) {
        scoreWhere.skillId = parseInt(skillId, 10);
        scoreWhere.skill = { apparatus_id: parseInt(apparatusId, 10) };
      } else if (apparatusId) {
        scoreWhere.skill = { apparatus_id: parseInt(apparatusId, 10) };
      } else if (skillId) {
        scoreWhere.skillId = parseInt(skillId, 10);
      }
      if (eventId) {
        scoreWhere.eventId = parseInt(eventId, 10);
      }

      const scoresWithFilter = await prisma.assessmentScore.findMany({
        where: scoreWhere,
        select: { studentId: true },
        distinct: ['studentId'],
      });
      const studentIdsFromScores = scoresWithFilter.map((s) => s.studentId);

      if (studentIdsFromScores.length === 0) {
        // No students have assessment scores for this apparatus/skill - return empty
        return NextResponse.json(
          jsonBigInt({
            data: [],
            pagination: { total: 0, page, limit, hasNext: false, hasPrev: false },
          }),
        );
      }

      // Filter StudentEventFee to only students with matching assessment scores
      whereClause.studentId = { in: studentIdsFromScores.map((id) => BigInt(id)) };
    }

    // Filter by search query
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

    // Count total records
    const total = await prisma.studentEventFee.count({
      where: whereClause,
    });

    // Determine orderBy based on sortField
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

    // Fetch student event fees with related data
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

    // Fetch team names for lookup
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
        select: {
          id: true,
          name: true,
        },
      });
      teams.forEach((team) => {
        teamMap.set(String(team.id), team.name);
      });
    }

    // Format the response data
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
        result: null, // Will be populated later when form is implemented
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

