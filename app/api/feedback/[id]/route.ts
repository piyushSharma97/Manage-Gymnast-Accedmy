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
 * GET /api/feedback/[id]
 * Get one feedback thread with all replies. Access: parent (own), admin/manager/coach (same tenant).
 */
export async function GET(
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

    const thread = await prisma.feedbackMessage.findFirst({
      where: { id: BigInt(id), parentMessageId: null },
      include: {
        guardian: {
          select: { id: true, firstName: true, lastName: true, email: true },
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
      },
    });

    if (!thread) {
      return NextResponse.json({ message: 'Thread not found' }, { status: 404 });
    }

    if (context.isParent) {
      const guardian = await prisma.guardian.findFirst({
        where: { userId: context.user.id },
      });
      if (!guardian || thread.guardianId !== guardian.id) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else if (context.isAdmin || context.isManager || context.isCoach) {
      if (context.tenantId && thread.tenantId !== context.tenantId) {
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: jsonBigInt(thread) });
  } catch (error) {
    console.error('[feedback GET id]', error);
    return NextResponse.json({ message: 'Failed to load thread' }, { status: 500 });
  }
}
