import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { jsonBigInt, getErrorMessage } from '@/types/api';

// GET: Fetch graph data showing high/low/student marks per apparatus
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
        dob: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    // Calculate student age
    const studentAge = student.dob 
      ? Math.floor((new Date().getTime() - new Date(student.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // Fetch all assessment scores for this event
    const allScores = await prisma.assessmentScore.findMany({
      where: {
        eventId: eid,
        tenantId,
      },
      select: {
        id: true,
        studentId: true,
        skillId: true,
        score: true,
        eventId: true,
        tenantId: true,
      },
    });

    // Fetch all skills to get apparatus information
    const skills = await prisma.skill.findMany({
      where: {
        tenant_id: tenantId,
      },
      select: {
        id: true,
        apparatus_id: true,
        apparatus_name: true,
      },
    });

    // Create a map for quick skill lookup
    const skillMap = new Map(skills.map((s) => [s.id, s]));

    // Fetch all students to get DOB information
    const studentIds = Array.from(new Set(allScores.map((s) => s.studentId)));
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds.map((id) => BigInt(id)) },
        tenantId,
      },
      select: {
        id: true,
        dob: true,
      },
    });

    // Create a map for quick student lookup
    const studentMap = new Map(students.map((s) => [Number(s.id), s]));

    // Fetch individual student scores for this event
    const studentScores = await prisma.assessmentScore.findMany({
      where: {
        studentId: sid,
        eventId: eid,
        tenantId,
      },
      select: {
        id: true,
        studentId: true,
        skillId: true,
        score: true,
      },
    });

    // Group scores by apparatus and calculate weighted scores
    type ApparatusData = {
      apparatusName: string;
      studentTotalScore: number;
      studentSkillCount: number;
      allScores: number[];
    };

    const apparatusMap = new Map<string, ApparatusData>();

    // Calculate student's score per apparatus (simple average)
    studentScores.forEach((score) => {
      const skill = skillMap.get(score.skillId);
      if (!skill) return;

      const apparatusName = skill.apparatus_name || 'Unknown';

      if (!apparatusMap.has(apparatusName)) {
        apparatusMap.set(apparatusName, {
          apparatusName,
          studentTotalScore: 0,
          studentSkillCount: 0,
          allScores: [],
        });
      }

      const data = apparatusMap.get(apparatusName)!;
      data.studentTotalScore += score.score || 0;
      data.studentSkillCount += 1;
    });

    // Calculate all students' scores per apparatus (filtering by age category)
    const apparatusStudentScores = new Map<string, Map<number, { totalScore: number; skillCount: number }>>();

    allScores.forEach((score) => {
      const skill = skillMap.get(score.skillId);
      if (!skill) return;

      const apparatusName = skill.apparatus_name || 'Unknown';
      const studentData = studentMap.get(score.studentId);

      // Calculate student age for filtering
      const scoreStudentAge = studentData?.dob
        ? Math.floor((new Date().getTime() - new Date(studentData.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : null;

      // Only include students in similar age category (±2 years)
      if (studentAge !== null && scoreStudentAge !== null) {
        const ageDiff = Math.abs(studentAge - scoreStudentAge);
        if (ageDiff > 2) {
          return; // Skip this student as they're not in the same age category
        }
      }

      if (!apparatusStudentScores.has(apparatusName)) {
        apparatusStudentScores.set(apparatusName, new Map());
      }

      const studentScoreMap = apparatusStudentScores.get(apparatusName)!;
      
      if (!studentScoreMap.has(score.studentId)) {
        studentScoreMap.set(score.studentId, { totalScore: 0, skillCount: 0 });
      }

      const studentScoreData = studentScoreMap.get(score.studentId)!;
      studentScoreData.totalScore += score.score || 0;
      studentScoreData.skillCount += 1;
    });

    // Calculate final normalized scores (0-100 scale) for each student per apparatus
    apparatusStudentScores.forEach((studentScoreMap, apparatusName) => {
      const data = apparatusMap.get(apparatusName);
      if (data) {
        studentScoreMap.forEach((studentScoreData) => {
          if (studentScoreData.skillCount > 0) {
            // Calculate average score and normalize to 0-100 scale (score range 1-4)
            const avgScore = studentScoreData.totalScore / studentScoreData.skillCount;
            const normalizedScore = ((avgScore - 1) / 3) * 100; // Map 1-4 to 0-100
            data.allScores.push(Math.round(Math.max(0, normalizedScore)));
          }
        });
      }
    });

    // Build final result with high, low, and student marks
    const graphData = Array.from(apparatusMap.values()).map((data) => {
      // Calculate student's normalized score (0-100 scale)
      const studentAvgScore = data.studentSkillCount > 0
        ? data.studentTotalScore / data.studentSkillCount
        : 0;
      const studentScore = Math.round(Math.max(0, ((studentAvgScore - 1) / 3) * 100));

      // Get high and low marks from age category
      const scores = data.allScores.length > 0 ? data.allScores : [0];
      const highMark = Math.max(...scores);
      const lowMark = Math.min(...scores);

      return {
        apparatus: data.apparatusName,
        highMark,
        lowMark,
        studentMark: studentScore,
      };
    }).sort((a, b) => a.apparatus.localeCompare(b.apparatus));

    return NextResponse.json(
      jsonBigInt({
        data: graphData,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
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
