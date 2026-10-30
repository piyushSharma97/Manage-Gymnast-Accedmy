import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { ensureParentOfStudent, jsonBigInt } from '@/lib/parent-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/parent/youtube-videos?studentId=...
 * Returns all parent YouTube links for the academy (tenant) the student belongs to.
 * Read-only; parents cannot create, update, or delete.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');

  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!context.isParent) {
      return NextResponse.json({ message: 'Parent or guardian access required' }, { status: 403 });
    }
    if (!studentIdParam) {
      return NextResponse.json({ message: 'studentId is required' }, { status: 400 });
    }

    const studentIdBigInt = BigInt(studentIdParam);
    const canAccess = await ensureParentOfStudent(context.user.id, studentIdBigInt);
    if (!canAccess) {
      return NextResponse.json({ message: 'You do not have access to this student' }, { status: 403 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentIdBigInt },
      select: { tenantId: true },
    });
    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const links = await prisma.parentYoutubeLink.findMany({
      where: { tenantId: student.tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        link: true,
        title: true,
        thumbnailUrl: true,
        description: true,
      },
    });

    return NextResponse.json(jsonBigInt({ data: links }));
  } catch (error) {
    console.error('[parent/youtube-videos]', error);
    return NextResponse.json({ message: 'Failed to fetch videos' }, { status: 500 });
  }
}
