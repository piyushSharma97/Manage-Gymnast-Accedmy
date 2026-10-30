import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: unknown) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch active (non-deleted) assessment comments for a student + event
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');
  const eventId = searchParams.get('eventId');

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach)) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'studentId and eventId are required' },
        { status: 400 },
      );
    }

    const comments = await prisma.assessmentComment.findMany({
      where: {
        studentId: parseInt(studentId, 10),
        eventid: parseInt(eventId, 10),
        tenantId: tenantContext.tenantId,
        deletedAt: null,
      },
      orderBy: { commentdate: 'desc' },
    });

    return NextResponse.json(jsonBigInt({ data: comments }));
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}

// POST: Add new assessment comment (optionally override = soft delete previous)
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach)) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { studentId, eventId, comment, override = false } = body;

    if (!studentId || !eventId) {
      return NextResponse.json(
        { message: 'studentId and eventId are required' },
        { status: 400 },
      );
    }

    const studentIdInt = parseInt(String(studentId), 10);
    const eventIdInt = parseInt(String(eventId), 10);

    if (isNaN(studentIdInt) || isNaN(eventIdInt)) {
      return NextResponse.json(
        { message: 'Invalid studentId or eventId' },
        { status: 400 },
      );
    }

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const result = await prisma.$transaction(async (tx) => {
      if (override) {
        await tx.assessmentComment.updateMany({
          where: {
            studentId: studentIdInt,
            eventid: eventIdInt,
            tenantId,
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }

      const newComment = await tx.assessmentComment.create({
        data: {
          studentId: studentIdInt,
          eventid: eventIdInt,
          tenantId,
          commentdate: currentDate,
          comment:
            comment && typeof comment === 'string'
              ? comment.trim().substring(0, 500)
              : null,
        },
      });

      return newComment;
    });

    return NextResponse.json(jsonBigInt(result));
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}
