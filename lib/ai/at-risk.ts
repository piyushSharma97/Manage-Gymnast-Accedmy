import { prisma } from '@/lib/prisma';

export type AtRiskStudent = {
  studentId: string;
  name: string;
  reasons: string[];
  score: number;
};

export type OpenTrial = {
  id: string;
  name: string;
  trialDate: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Rank active students in one academy. A coach or admin reads the list.
 * This function does not send email or change records.
 */
export async function listAtRiskStudents(input: {
  tenantId: number;
  locationId?: number;
}): Promise<{ students: AtRiskStudent[]; openTrials: OpenTrial[] }> {
  const sinceAttendance = new Date(Date.now() - THIRTY_DAYS_MS);
  const sinceScores = new Date(Date.now() - NINETY_DAYS_MS);
  const now = new Date();

  const students = await prisma.student.findMany({
    where: {
      tenantId: input.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(input.locationId ? { locationId: input.locationId } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    take: 400,
  });

  if (students.length === 0) {
    return { students: [], openTrials: await openTrials(input.tenantId) };
  }

  const studentIds = students.map((student) => student.id);
  const scoreIds = studentIds
    .map((id) => Number(id))
    .filter((id) => Number.isSafeInteger(id));

  const [attendanceRows, invoiceRows, lowScoreRows] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['studentId'],
      where: {
        tenantId: input.tenantId,
        studentId: { in: studentIds },
        sessionDate: { gte: sinceAttendance },
      },
      _count: { id: true },
    }),
    prisma.invoice.groupBy({
      by: ['studentId'],
      where: {
        tenantId: input.tenantId,
        studentId: { in: studentIds },
        OR: [
          { status: 'Overdue' },
          {
            status: { in: ['Pending', 'PartiallyPaid'] },
            dueDate: { lt: now },
          },
        ],
      },
      _count: { id: true },
    }),
    scoreIds.length === 0
      ? Promise.resolve([] as { studentId: number; _count: { id: number } }[])
      : prisma.assessmentScore.groupBy({
          by: ['studentId'],
          where: {
            tenantId: input.tenantId,
            studentId: { in: scoreIds },
            score: { lte: 1 },
            eventdate: { gte: sinceScores },
          },
          _count: { id: true },
        }),
  ]);

  const attendanceByStudent = new Map(
    attendanceRows.map((row) => [row.studentId.toString(), row._count.id]),
  );
  const invoicesByStudent = new Map(
    invoiceRows.map((row) => [row.studentId.toString(), row._count.id]),
  );
  const lowScoresByStudent = new Map(
    lowScoreRows.map((row) => [String(row.studentId), row._count.id]),
  );

  const ranked: AtRiskStudent[] = [];
  for (const student of students) {
    const id = student.id.toString();
    const reasons: string[] = [];
    let score = 0;
    const visits = attendanceByStudent.get(id) ?? 0;
    const overdue = invoicesByStudent.get(id) ?? 0;
    const lowSkills = lowScoresByStudent.get(id) ?? 0;

    if (visits === 0) {
      reasons.push('No attendance in the last 30 days');
      score += 3;
    } else if (visits <= 2) {
      reasons.push(`Only ${visits} class${visits === 1 ? '' : 'es'} in the last 30 days`);
      score += 1;
    }
    if (overdue > 0) {
      reasons.push(`${overdue} overdue invoice${overdue === 1 ? '' : 's'}`);
      score += 2;
    }
    if (lowSkills >= 3) {
      reasons.push(`${lowSkills} skills still marked learning in the last 90 days`);
      score += 1;
    }

    if (score === 0) continue;
    const name = [student.firstName, student.lastName].filter(Boolean).join(' ').trim();
    ranked.push({
      studentId: id,
      name: name || 'Student',
      reasons,
      score,
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    students: ranked.slice(0, 8),
    openTrials: await openTrials(input.tenantId),
  };
}

async function openTrials(tenantId: number): Promise<OpenTrial[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const trials = await prisma.trial.findMany({
    where: {
      tenantId,
      isRegistered: false,
      trialDate: { lte: cutoff },
    },
    select: {
      id: true,
      participantName: true,
      trialDate: true,
    },
    orderBy: { trialDate: 'asc' },
    take: 5,
  });

  return trials.map((trial) => ({
    id: trial.id.toString(),
    name: trial.participantName,
    trialDate: trial.trialDate.toISOString(),
  }));
}
