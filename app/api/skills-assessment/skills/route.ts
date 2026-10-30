import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch skills grouped by apparatus for assessment form
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const gender = searchParams.get('gender');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission (admin or coach)
    if (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // If studentId is provided, fetch student to get gender
    let studentGender = gender;
    if (studentId && !gender) {
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          tenantId: tenantContext.tenantId,
        },
        select: {
          gender: true,
        },
      });

      if (student) {
        studentGender = student.gender;
      }
    }

    // Create tenant-aware filters
    const tenantFilters = createTenantFilters(tenantContext);

    // Build where clause for skills
    const whereClause: any = {
      deletedAt: null, // Only active skills
      status: 'active',
    };

    // Filter by tenant
    if (tenantContext.tenantId) {
      whereClause.tenant_id = tenantContext.tenantId;
    }

    // Filter by gender: show skills for student's gender and Mixed
    if (studentGender) {
      whereClause.OR = [
        { gender: studentGender },
        { gender: 'Mixed' },
      ];
    }

    // Fetch all skills matching the criteria
    const skills = await prisma.skill.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        apparatus_id: true,
        apparatus_name: true,
        gender: true,
        level: true,
        color: true,
      },
      orderBy: [
        { apparatus_id: 'asc' },
        { name: 'asc' },
      ],
    });

    // Fetch apparatus details
    const apparatusIds = Array.from(new Set(skills.map(s => s.apparatus_id)));
    const apparatusList = await prisma.apparatus.findMany({
      where: {
        id: { in: apparatusIds },
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        gender: true,
        sequence: true,
      },
      orderBy: {
        sequence: 'asc',
      },
    });

    // Group skills by apparatus
    const skillsByApparatus: Record<number, any[]> = {};
    skills.forEach((skill) => {
      if (!skillsByApparatus[skill.apparatus_id]) {
        skillsByApparatus[skill.apparatus_id] = [];
      }
      skillsByApparatus[skill.apparatus_id].push(skill);
    });

    // Build response with apparatus and their skills
    const result = apparatusList
      .filter((apparatus) => skillsByApparatus[apparatus.id])
      .map((apparatus) => ({
        id: apparatus.id,
        name: apparatus.name,
        shortName: apparatus.shortName || apparatus.name,
        gender: apparatus.gender,
        sequence: apparatus.sequence,
        skills: skillsByApparatus[apparatus.id].map((skill) => ({
          id: skill.id,
          name: skill.name,
          apparatusId: skill.apparatus_id,
          apparatusName: skill.apparatus_name,
          gender: skill.gender,
          level: skill.level,
          color: skill.color,
        })),
      }));

    return NextResponse.json(
      jsonBigInt({
        data: result,
        studentGender: studentGender || null,
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

