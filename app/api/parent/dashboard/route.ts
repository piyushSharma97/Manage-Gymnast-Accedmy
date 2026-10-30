import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/dashboard?studentId=...
 * Returns dashboard data for one child: name, level, attendance, progress, skills (for graph).
 * Only allowed if current user is the guardian of that student.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');

  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!context.isParent) {
      return NextResponse.json(
        { message: 'Parent or guardian access required' },
        { status: 403 },
      );
    }
    if (!studentIdParam) {
      return NextResponse.json(
        { message: 'studentId is required' },
        { status: 400 },
      );
    }

    const studentIdBigInt = BigInt(studentIdParam);
    const canAccess = await ensureParentOfStudent(context.user.id, studentIdBigInt);
    if (!canAccess) {
      return NextResponse.json(
        { message: 'You do not have access to this student' },
        { status: 403 },
      );
    }

    // Student.id is BigInt; AssessmentScore.studentId is Int - use Number for legacy table
    const studentIdInt = Number(studentIdParam);

    const student = await prisma.student.findUnique({
      where: { id: studentIdBigInt },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        skilllevelName: true,
        registrationNo: true,
        courseId: true,
        dob: true,
        gender: true,
        joinDate: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    if (context.tenantId != null && context.tenantId !== student.tenantId) {
      return NextResponse.json(
        { message: 'You do not have access to this student' },
        { status: 403 },
      );
    }

    const tenantId = student.tenantId;

    const [attendanceCount, enrollments, latestScores, assessmentComments] =
      await Promise.all([
        prisma.attendance.count({
          where: { studentId: studentIdBigInt },
        }),
        prisma.enrollment.findMany({
          where: { studentId: studentIdBigInt, active: true },
          include: {
            course: { select: { courseName: true } },
            program: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.assessmentScore.findMany({
          where: {
            studentId: studentIdInt,
            tenantId,
          },
          include: {
            skill: {
              select: {
                id: true,
                name: true,
                apparatus_name: true,
                color: true,
              },
            },
          },
          orderBy: { eventdate: 'desc' },
          take: 100,
        }),
        prisma.assessmentComment.findMany({
          where: {
            studentId: studentIdInt,
            tenantId,
          },
          orderBy: { commentdate: 'desc' },
          take: 5,
        }),
      ]);

    // Build skills data for graph: latest score per skill (by skill id), for parent-friendly view
    const skillScoresBySkillId = new Map<
      number,
      { skillName: string; apparatusName: string; score: number; level: string | null; color: string | null }
    >();
    for (const s of latestScores) {
      if (!skillScoresBySkillId.has(s.skillId)) {
        skillScoresBySkillId.set(s.skillId, {
          skillName: s.skill.name,
          apparatusName: s.skill.apparatus_name || '—',
          score: s.score,
          level: s.level,
          color: s.skill.color ?? null,
        });
      }
    }
    const skillsForGraph = Array.from(skillScoresBySkillId.entries()).map(
      ([skillId, v]) => ({
        skillId,
        name: v.skillName,
        apparatus: v.apparatusName,
        score: v.score,
        level: v.level,
        color: v.color,
      }),
    );

    const graphScores = skillsForGraph.map((s) => s.score);
    const averageScore =
      graphScores.length > 0
        ? Math.round(
            (graphScores.reduce((a, b) => a + b, 0) / graphScores.length) * 10,
          ) / 10
        : null;

    const level =
      student.skilllevelName ||
      (enrollments[0]?.course?.courseName ?? enrollments[0]?.program?.name ?? null) ||
      '—';

    const formatDate = (d: Date | null) =>
      d ? d.toISOString().split('T')[0] : null;

    const payload = {
      name: `${student.firstName} ${student.lastName || ''}`.trim(),
      level,
      registrationNo: student.registrationNo,
      dateOfBirth: formatDate(student.dob),
      gender: student.gender,
      joinDate: formatDate(student.joinDate),
      classesCompleted: attendanceCount,
      averageScore,
      enrollments: enrollments.map((e) => ({
        courseName: e.course?.courseName,
        programName: e.program?.name,
        status: e.status,
      })),
      progress: {
        latestScores: latestScores.slice(0, 10).map((s) => ({
          skillName: s.skill.name,
          apparatusName: s.skill.apparatus_name,
          score: s.score,
          level: s.level,
          eventdate: s.eventdate.toISOString().split('T')[0],
        })),
        recentComments: assessmentComments.map((c) => ({
          comment: c.comment,
          commentdate: c.commentdate.toISOString().split('T')[0],
        })),
      },
      skills: skillsForGraph,
    };

    return NextResponse.json(jsonBigInt(payload));
  } catch (error) {
    console.error('[parent/dashboard]', error);
    return NextResponse.json(
      { message: 'Failed to load dashboard' },
      { status: 500 },
    );
  }
}
