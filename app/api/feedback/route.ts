import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: unknown) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

/**
 * GET /api/feedback
 * List feedback threads: for parent (their threads), for admin/manager/coach (tenant threads).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (context.isParent) {
      const guardian = await prisma.guardian.findFirst({
        where: { userId: context.user.id },
      });
      if (!guardian) {
        return NextResponse.json({ data: [] });
      }
      const threads = await prisma.feedbackMessage.findMany({
        where: {
          guardianId: guardian.id,
          parentMessageId: null,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          guardian: {
            select: { firstName: true, lastName: true, email: true },
          },
          replies: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              senderUserId: true,
              senderRole: true,
              body: true,
              createdAt: true,
            },
          },
          _count: { select: { replies: true } },
        },
      });
      return NextResponse.json({ data: jsonBigInt(threads) });
    }

    if (context.isAdmin || context.isManager || context.isCoach) {
      if (!context.tenantId) {
        return NextResponse.json({ data: [] });
      }
      const threads = await prisma.feedbackMessage.findMany({
        where: {
          tenantId: context.tenantId,
          parentMessageId: null,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          guardian: {
            select: { firstName: true, lastName: true, email: true },
          },
          replies: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              senderUserId: true,
              senderRole: true,
              body: true,
              createdAt: true,
            },
          },
          _count: { select: { replies: true } },
        },
      });
      return NextResponse.json({ data: jsonBigInt(threads) });
    }

    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('[feedback GET]', error);
    return NextResponse.json({ message: 'Failed to list feedback' }, { status: 500 });
  }
}

/**
 * POST /api/feedback
 * Parent sends a new feedback message. Notifications created for staff (admin/manager/coach) in tenant.
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!context.isParent) {
      return NextResponse.json({ message: 'Only parents can send feedback' }, { status: 403 });
    }

    const guardian = await prisma.guardian.findFirst({
      where: { userId: context.user.id },
    });
    if (!guardian) {
      return NextResponse.json({ message: 'Guardian profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    // Get staff user IDs (admin, manager, coach) for this tenant
    const staffRoles = await prisma.userRole.findMany({
      where: { slug: { in: ['admin', 'manager', 'coach'] }, isActive: true },
      select: { id: true },
    });
    const roleIds = staffRoles.map((r) => r.id);
    const staffUsers = await prisma.user.findMany({
      where: {
        tenantId: context.tenantId ?? guardian.tenantId,
        roleId: { in: roleIds },
        status: 'ACTIVE',
        isTrashed: false,
      },
      select: { id: true },
    });

    const feedback = await prisma.feedbackMessage.create({
      data: {
        tenantId: guardian.tenantId,
        guardianId: guardian.id,
        senderUserId: context.user.id,
        senderRole: 'parent',
        subject: subject || null,
        body: message,
      },
    });

    const notificationData = staffUsers.map((u) => ({
      feedbackMessageId: feedback.id,
      userId: u.id,
    }));
    if (notificationData.length > 0) {
      await prisma.feedbackNotification.createMany({
        data: notificationData,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      data: jsonBigInt({
        id: feedback.id,
        subject: feedback.subject,
        body: feedback.body,
        createdAt: feedback.createdAt,
      }),
    });
  } catch (error) {
    console.error('[feedback POST]', error);
    return NextResponse.json({ message: 'Failed to send feedback' }, { status: 500 });
  }
}
