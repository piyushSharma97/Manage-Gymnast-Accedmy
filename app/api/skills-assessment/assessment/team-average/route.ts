import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch team average scores for a specific assessment/event and individual student score
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const eventId = searchParams.get('eventId');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);

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

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'Student ID and Event ID are required' },
        { status: 400 },
      );
    }

    const sid = parseInt(studentId, 10);
    const eid = parseInt(eventId, 10);
    const tenantId = tenantContext.tenantId;

    // Fetch event details
    const event = await prisma.event.findFirst({
      where: { id: eid, tenantId },
      select: { 
        name: true,
        event_type: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { message: 'Event not found' },
        { status: 404 },
      );
    }

    // Fetch student details
    const student = await prisma.student.findFirst({
      where: { 
        id: BigInt(sid),
        tenantId,
      },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    // Fetch all assessment scores for this event grouped by apparatus
    const allScores = await prisma.assessmentScore.findMany({
      where: {
        eventId: eid,
        tenantId,
      },
      include: {
        skill: {
          select: {
            apparatus_id: true,
            apparatus_name: true,
          },
        },
      },
    });

    // Fetch individual student scores for this event
    const studentScores = await prisma.assessmentScore.findMany({
      where: {
        studentId: sid,
        eventId: eid,
        tenantId,
      },
      include: {
        skill: {
          select: {
            apparatus_id: true,
            apparatus_name: true,
          },
        },
      },
    });

    // Group scores by apparatus and calculate statistics
    const apparatusStats = new Map<string, {
      apparatusName: string;
      totalScore: number;
      studentCount: number;
      avgScore: number;
      studentScore: number;
    }>();

    // Calculate team totals and counts
    const apparatusStudentCount = new Map<string, Set<number>>();
    
    allScores.forEach((score) => {
      const apparatusName = score.skill.apparatus_name || 'Unknown';
      const scoreValue = score.score || 0;
      
      if (!apparatusStats.has(apparatusName)) {
        apparatusStats.set(apparatusName, {
          apparatusName,
          totalScore: 0,
          studentCount: 0,
          avgScore: 0,
          studentScore: 0,
        });
      }

      if (!apparatusStudentCount.has(apparatusName)) {
        apparatusStudentCount.set(apparatusName, new Set());
      }

      const stats = apparatusStats.get(apparatusName)!;
      stats.totalScore += scoreValue;
      apparatusStudentCount.get(apparatusName)!.add(score.studentId);
    });

    // Update student counts
    apparatusStudentCount.forEach((students, apparatusName) => {
      const stats = apparatusStats.get(apparatusName);
      if (stats) {
        stats.studentCount = students.size;
        stats.avgScore = stats.studentCount > 0 
          ? Math.round(stats.totalScore / stats.studentCount) 
          : 0;
      }
    });

    // Add individual student scores
    studentScores.forEach((score) => {
      const apparatusName = score.skill.apparatus_name || 'Unknown';
      const stats = apparatusStats.get(apparatusName);
      if (stats) {
        stats.studentScore += score.score || 0;
      }
    });

    // Convert to array and sort by apparatus name
    const results = Array.from(apparatusStats.values()).sort((a, b) => 
      a.apparatusName.localeCompare(b.apparatusName)
    );

    return NextResponse.json(
      jsonBigInt({
        data: results,
        eventName: event.name,
        eventType: event.event_type,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
        total: results.length,
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
