import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { parseAchievedNumeric } from '@/lib/fitness-result-numeric';
import { fetchFitnessResultsForEvent } from '@/lib/fitness-result-raw';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Team average for fitness assessment - by category (level), using numeric achieved values
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const eventId = searchParams.get('eventId');

  try {
    const tenantContext = await getTenantContext(request);
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

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'Student ID and Event ID are required' },
        { status: 400 },
      );
    }

    const sid = parseInt(studentId, 10);
    const eid = parseInt(eventId, 10);
    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 403 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eid, tenantId },
      select: { name: true, event_type: true },
    });
    if (!event) {
      return NextResponse.json(
        { message: 'Event not found' },
        { status: 404 },
      );
    }

    const student = await prisma.student.findFirst({
      where: { id: BigInt(sid), tenantId },
      select: { firstName: true, lastName: true },
    });

    const allScores = await fetchFitnessResultsForEvent(prisma, eid, tenantId);
    const studentScores = await fetchFitnessResultsForEvent(
      prisma,
      eid,
      tenantId,
      BigInt(sid),
    );

    const levelStats = new Map<
      string,
      {
        apparatusName: string;
        totalNumeric: number;
        rowCount: number;
        studentCount: number;
        avgScore: number;
        studentScore: number;
      }
    >();
    const levelStudentCount = new Map<string, Set<number>>();

    allScores.forEach((score) => {
      const levelName = score.category_name || 'Other';
      const n = parseAchievedNumeric(score.achieved_value);
      if (!levelStats.has(levelName)) {
        levelStats.set(levelName, {
          apparatusName: levelName,
          totalNumeric: 0,
          rowCount: 0,
          studentCount: 0,
          avgScore: 0,
          studentScore: 0,
        });
      }
      if (!levelStudentCount.has(levelName)) {
        levelStudentCount.set(levelName, new Set());
      }
      levelStats.get(levelName)!.totalNumeric += n;
      levelStats.get(levelName)!.rowCount += 1;
      levelStudentCount.get(levelName)!.add(Number(score.gymnast_id));
    });

    levelStudentCount.forEach((students, levelName) => {
      const stats = levelStats.get(levelName);
      if (stats) {
        stats.studentCount = students.size;
        stats.avgScore =
          stats.studentCount > 0
            ? Math.round(stats.totalNumeric / stats.rowCount)
            : 0;
      }
    });

    studentScores.forEach((score) => {
      const levelName = score.category_name || 'Other';
      const stats = levelStats.get(levelName);
      if (stats) {
        stats.studentScore += parseAchievedNumeric(score.achieved_value);
      }
    });

    const results = Array.from(levelStats.values())
      .sort((a, b) => a.apparatusName.localeCompare(b.apparatusName))
      .map((s) => ({
        apparatusName: s.apparatusName,
        /** Sum of parsed achieved values for all students in this category (all skill rows) */
        totalScore: s.totalNumeric,
        studentCount: s.studentCount,
        avgScore: s.avgScore,
        studentScore: s.studentScore,
      }));

    return NextResponse.json(
      jsonBigInt({
        data: results,
        eventName: event.name,
        eventType: event.event_type,
        studentName: student
          ? `${student.firstName} ${student.lastName}`
          : 'Unknown',
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
