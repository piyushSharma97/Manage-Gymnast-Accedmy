import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

/**
 * GET /api/feedback/notifications/count
 * Unread feedback notification count for current user (bell icon).
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const count = await prisma.feedbackNotification.count({
      where: {
        userId: context.user.id,
        readAt: null,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('[feedback notifications count]', error);
    return NextResponse.json({ message: 'Failed to get count' }, { status: 500 });
  }
}
