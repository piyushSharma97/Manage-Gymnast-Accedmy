import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

/**
 * PATCH /api/feedback/notifications/read
 * Mark notifications as read. Body: { messageIds?: number[] } (thread root ids) or mark all for user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const messageIds = Array.isArray(body?.messageIds)
      ? (body.messageIds as unknown[])
          .map((id) => (typeof id === 'number' ? id : Number(id)))
          .filter((n) => Number.isInteger(n) && n > 0)
      : null;

    if (messageIds && messageIds.length > 0) {
      // Mark read for notifications that belong to these thread roots or their replies
      const rootIds = messageIds.map((id) => BigInt(id));
      const replyIds = await prisma.feedbackMessage.findMany({
        where: { parentMessageId: { in: rootIds } },
        select: { id: true },
      });
      const allMessageIds = [...rootIds, ...replyIds.map((r) => r.id)];
      await prisma.feedbackNotification.updateMany({
        where: {
          userId: context.user.id,
          feedbackMessageId: { in: allMessageIds },
        },
        data: { readAt: new Date() },
      });
    } else {
      // Mark all as read for current user
      await prisma.feedbackNotification.updateMany({
        where: { userId: context.user.id },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[feedback notifications read]', error);
    return NextResponse.json({ message: 'Failed to mark read' }, { status: 500 });
  }
}
