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
 * POST /api/feedback/[id]/reply
 * Add a reply to a feedback thread. Staff (admin/manager/coach) or parent (guardian) can reply.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ message: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    const root = await prisma.feedbackMessage.findFirst({
      where: { id: BigInt(id), parentMessageId: null },
      include: { guardian: { select: { id: true, userId: true } } },
    });

    if (!root) {
      return NextResponse.json({ message: 'Thread not found' }, { status: 404 });
    }

    const isParent = context.isParent;
    const isStaff = context.isAdmin || context.isManager || context.isCoach;

    if (isParent) {
      const guardian = await prisma.guardian.findFirst({
        where: { userId: context.user.id },
      });
      if (!guardian || root.guardianId !== guardian.id) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else if (isStaff) {
      if (context.tenantId && root.tenantId !== context.tenantId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const senderRole = isParent ? 'parent' : (context.user.roleSlug as string);

    const reply = await prisma.feedbackMessage.create({
      data: {
        tenantId: root.tenantId,
        guardianId: root.guardianId,
        senderUserId: context.user.id,
        senderRole,
        parentMessageId: root.id,
        body: message,
      },
    });

    // Notify the other side: if staff replied, notify parent; if parent replied, notify staff
    if (isStaff && root.guardian?.userId) {
      await prisma.feedbackNotification.create({
        data: {
          feedbackMessageId: reply.id,
          userId: root.guardian.userId,
        },
      });
    } else if (isParent) {
      const staffRoles = await prisma.userRole.findMany({
        where: { slug: { in: ['admin', 'manager', 'coach'] }, isActive: true },
        select: { id: true },
      });
      const staffUsers = await prisma.user.findMany({
        where: {
          tenantId: root.tenantId,
          roleId: { in: staffRoles.map((r) => r.id) },
          status: 'ACTIVE',
          isTrashed: false,
        },
        select: { id: true },
      });
      const notificationData = staffUsers.map((u) => ({
        feedbackMessageId: reply.id,
        userId: u.id,
      }));
      if (notificationData.length > 0) {
        await prisma.feedbackNotification.createMany({
          data: notificationData,
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({
      data: jsonBigInt({
        id: reply.id,
        body: reply.body,
        senderRole: reply.senderRole,
        createdAt: reply.createdAt,
      }),
    });
  } catch (error) {
    console.error('[feedback reply POST]', error);
    return NextResponse.json({ message: 'Failed to send reply' }, { status: 500 });
  }
}
