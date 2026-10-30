import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// POST: Submit skill assessment
export async function POST(request: NextRequest) {
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

    const tenantId = tenantContext.tenantId;
    if (tenantId === undefined) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { studentId, eventId, comments, skillRatings } = body;

    if (!studentId) {
      return NextResponse.json(
        { message: 'Student ID is required' },
        { status: 400 },
      );
    }

    // Verify student exists
    const student = await prisma.student.findFirst({
      where: {
        id: BigInt(studentId),
        tenantId,
      },
    });

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found' },
        { status: 404 },
      );
    }

    // Verify event exists if provided
    let event = null;
    if (eventId) {
      event = await prisma.event.findFirst({
        where: {
          id: eventId,
          tenantId,
        },
      });

      if (!event) {
        return NextResponse.json(
          { message: 'Event not found' },
          { status: 404 },
        );
      }
    }

    if (!eventId) {
      return NextResponse.json(
        { message: 'Event ID is required' },
        { status: 400 },
      );
    }

    // Convert studentId from BigInt to Int for the assessment tables
    const studentIdInt = parseInt(studentId, 10);
    if (isNaN(studentIdInt)) {
      return NextResponse.json(
        { message: 'Invalid student ID' },
        { status: 400 },
      );
    }

    // Get current date for commentdate and eventdate
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set to start of day

    // Map rating to score: LEARNING=1, AVERAGE=2, GOOD=3, EXCELLENT=4
    const ratingToScore: Record<string, number> = {
      LEARNING: 1,
      AVERAGE: 2,
      GOOD: 3,
      EXCELLENT: 4,
    };

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Save assessment comment if provided
      let commentId = null;
      if (comments && comments.trim()) {
        const comment = await tx.assessmentComment.create({
          data: {
            eventid: eventId,
            tenantId,
            studentId: studentIdInt,
            commentdate: currentDate,
            comment: comments.trim().substring(0, 500), // Ensure it fits in varchar(500)
          },
        });
        commentId = comment.id;
      }

      // Save assessment scores
      const scores = [];
      if (skillRatings && Array.isArray(skillRatings) && skillRatings.length > 0) {
        for (const rating of skillRatings) {
          if (!rating.skillId || !rating.rating) {
            continue; // Skip invalid ratings
          }

          const score = ratingToScore[rating.rating];
          if (!score) {
            continue; // Skip invalid rating values
          }

          // Get skill to retrieve level and apparatus_id (use payload apparatusId if sent)
          const skill = await tx.skill.findUnique({
            where: { id: rating.skillId },
            select: { level: true, apparatus_id: true },
          });

          const apparatusId = rating.apparatusId ?? skill?.apparatus_id;
          if (!apparatusId) {
            continue; // Skip if no apparatus
          }

          const scoreRecord = await tx.assessmentScore.create({
            data: {
              studentId: studentIdInt,
              apparatus_id: apparatusId,
              skillId: rating.skillId,
              level: skill?.level || null,
              score: score,
              eventId: eventId,
              tenantId,
              eventdate: currentDate,
              remark: rating.remarks
                ? rating.remarks.trim().substring(0, 200)
                : null, // Ensure it fits in varchar(200)
            },
          });
          scores.push(scoreRecord);
        }
      }

      return {
        commentId,
        scoresCount: scores.length,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        message: 'Assessment submitted successfully',
        commentId: result.commentId,
        scoresCount: result.scoresCount,
      }),
      { status: 201 },
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

