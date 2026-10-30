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
 * GET /api/feedback/notifications
 * List recent unread feedback notifications for the bell dropdown (with thread preview).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 50);

    const notifications = await prisma.feedbackNotification.findMany({
      where: { userId: context.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        feedbackMessage: {
          select: {
            id: true,
            subject: true,
            body: true,
            senderRole: true,
            parentMessageId: true,
            createdAt: true,
            guardianId: true,
            guardian: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Resolve thread root for replies (so we link to thread)
    const withRoot = await Promise.all(
      notifications.map(async (n) => {
        const msg = n.feedbackMessage;
        const rootId =
          msg.parentMessageId !== null
            ? (
                await prisma.feedbackMessage.findUnique({
                  where: { id: msg.parentMessageId },
                  select: { id: true },
                })
              )?.id ?? msg.id
            : msg.id;
        return {
          id: n.id.toString(),
          readAt: n.readAt,
          createdAt: n.createdAt,
          messageId: msg.id.toString(),
          rootId: rootId.toString(),
          subject: msg.subject,
          body: msg.body,
          senderRole: msg.senderRole,
          guardianName:
            msg.guardian &&
            [msg.guardian.firstName, msg.guardian.lastName].filter(Boolean).join(' '),
        };
      }),
    );

    return NextResponse.json({ data: jsonBigInt(withRoot) });
  } catch (error) {
    console.error('[feedback notifications list]', error);
    return NextResponse.json({ message: 'Failed to list notifications' }, { status: 500 });
  }
}
