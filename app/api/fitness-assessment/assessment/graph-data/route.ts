import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { jsonBigInt, getErrorMessage } from '@/types/api';
import { parseAchievedNumeric } from '@/lib/fitness-result-numeric';
import { fetchFitnessResultsForEvent } from '@/lib/fitness-result-raw';

// GET: Graph data for fitness assessment - by category (level)
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
      select: { firstName: true, lastName: true, dob: true },
    });
    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    const studentAge = student.dob
      ? Math.floor(
          (new Date().getTime() - new Date(student.dob).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        )
      : null;

    const allScores = await fetchFitnessResultsForEvent(prisma, eid, tenantId);
    const studentScores = await fetchFitnessResultsForEvent(
      prisma,
      eid,
      tenantId,
      BigInt(sid),
    );

    const studentIds = Array.from(new Set(allScores.map((s) => Number(s.gymnast_id))));
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds.map((id) => BigInt(id)) },
        tenantId,
      },
      select: { id: true, dob: true },
    });
    const studentMap = new Map(students.map((s) => [Number(s.id), s]));

    type LevelData = {
      levelName: string;
      studentTotalNumeric: number;
      studentSkillCount: number;
      allScores: number[];
      maxNumericInLevel: number;
    };
    const levelMap = new Map<string, LevelData>();

    studentScores.forEach((score) => {
      const levelName = score.category_name || 'Other';
      const n = parseAchievedNumeric(score.achieved_value);
      if (!levelMap.has(levelName)) {
        levelMap.set(levelName, {
          levelName,
          studentTotalNumeric: 0,
          studentSkillCount: 0,
          allScores: [],
          maxNumericInLevel: 0,
        });
      }
      const data = levelMap.get(levelName)!;
      data.studentTotalNumeric += n;
      data.studentSkillCount += 1;
    });

    const levelStudentScores = new Map<
      string,
      Map<number, { totalNumeric: number; skillCount: number }>
    >();

    allScores.forEach((score) => {
      const levelName = score.category_name || 'Other';
      const studentData = studentMap.get(Number(score.gymnast_id));
      const scoreStudentAge = studentData?.dob
        ? Math.floor(
            (new Date().getTime() - new Date(studentData.dob).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000),
          )
        : null;
      if (
        studentAge !== null &&
        scoreStudentAge !== null &&
        Math.abs(studentAge - scoreStudentAge) > 2
      ) {
        return;
      }
      const n = parseAchievedNumeric(score.achieved_value);
      if (!levelStudentScores.has(levelName)) {
        levelStudentScores.set(levelName, new Map());
      }
      const studentScoreMap = levelStudentScores.get(levelName)!;
      const sidNum = Number(score.gymnast_id);
      if (!studentScoreMap.has(sidNum)) {
        studentScoreMap.set(sidNum, { totalNumeric: 0, skillCount: 0 });
      }
      const d = studentScoreMap.get(sidNum)!;
      d.totalNumeric += n;
      d.skillCount += 1;
    });

    levelStudentScores.forEach((studentScoreMap, levelName) => {
      let maxAvg = 0;
      studentScoreMap.forEach((studentScoreData) => {
        if (studentScoreData.skillCount > 0) {
          const avg = studentScoreData.totalNumeric / studentScoreData.skillCount;
          if (avg > maxAvg) maxAvg = avg;
        }
      });
      const data = levelMap.get(levelName);
      if (data) {
        data.maxNumericInLevel = maxAvg > 0 ? maxAvg : 1;
        studentScoreMap.forEach((studentScoreData) => {
          if (studentScoreData.skillCount > 0) {
            const avg = studentScoreData.totalNumeric / studentScoreData.skillCount;
            const max = data.maxNumericInLevel || 1;
            const normalizedScore = Math.round(Math.min(100, Math.max(0, (avg / max) * 100)));
            data.allScores.push(normalizedScore);
          }
        });
      }
    });

    const graphData = Array.from(levelMap.values()).map((data) => {
      const studentAvgNumeric =
        data.studentSkillCount > 0
          ? data.studentTotalNumeric / data.studentSkillCount
          : 0;
      const max = data.maxNumericInLevel || 1;
      const studentScore = Math.round(
        Math.min(100, Math.max(0, (studentAvgNumeric / max) * 100)),
      );
      const scores = data.allScores.length > 0 ? data.allScores : [0];
      return {
        apparatus: data.levelName,
        highMark: Math.max(...scores),
        lowMark: Math.min(...scores),
        studentMark: studentScore,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        data: graphData,
        studentName: student
          ? `${student.firstName} ${student.lastName}`
          : 'Unknown',
        studentAge,
        eventName: event.name,
        eventType: event.event_type,
      }),
    );
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
