import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { generateCommentDraft, type ScoreLine } from '@/lib/ai/comment-draft';

const RATINGS = new Set(['LEARNING', 'AVERAGE', 'GOOD', 'EXCELLENT']);

export async function POST(request: NextRequest) {
  const tenantContext = await getTenantContext(request);
  if (
    !tenantContext?.tenantId ||
    (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach)
  ) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const studentId = body?.studentId;
  const rawScores = Array.isArray(body?.scores) ? body.scores : [];

  if (!studentId) {
    return NextResponse.json({ message: 'studentId is required' }, { status: 400 });
  }

  let student;
  try {
    student = await prisma.student.findFirst({
      where: {
        id: BigInt(studentId),
        tenantId: tenantContext.tenantId,
        deletedAt: null,
      },
      select: { firstName: true, lastName: true },
    });
  } catch {
    return NextResponse.json({ message: 'Invalid student' }, { status: 400 });
  }

  if (!student) {
    return NextResponse.json({ message: 'Student not found' }, { status: 404 });
  }

  const scores: ScoreLine[] = rawScores
    .map((row: { skillName?: unknown; rating?: unknown }) => ({
      skillName: typeof row?.skillName === 'string' ? row.skillName.slice(0, 80) : '',
      rating: typeof row?.rating === 'string' ? row.rating : '',
    }))
    .filter((row: ScoreLine) => row.skillName && RATINGS.has(row.rating))
    .slice(0, 40);

  if (scores.length === 0) {
    return NextResponse.json(
      { message: 'Rate at least one skill before drafting a comment.' },
      { status: 400 },
    );
  }

  const name = [student.firstName, student.lastName].filter(Boolean).join(' ').trim() || 'Student';
  const result = await generateCommentDraft(name, scores);
  return NextResponse.json(result);
}
