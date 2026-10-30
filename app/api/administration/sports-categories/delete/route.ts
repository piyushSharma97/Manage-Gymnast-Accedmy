import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// DELETE: Bulk delete sports categories
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map((x: any) => Number(x)).filter((x: number) => !Number.isNaN(x)) : [];

    if (ids.length === 0) {
      return NextResponse.json({ message: 'No categories selected.' }, { status: 400 });
    }

    // Perform soft deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Check if all categories exist and are not already deleted
      const categories = await tx.sportsCategory.findMany({
        where: { id: { in: ids } },
      });

      if (categories.length !== ids.length) {
        throw new Error('One or more categories not found.');
      }

      const alreadyDeleted = categories.filter(c => c.deletedAt !== null);
      if (alreadyDeleted.length > 0) {
        throw new Error('One or more categories are already deleted.');
      }

      // Soft delete: set deletedAt instead of actually deleting
      await tx.sportsCategory.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date(), updatedBy: session.user.id },
      });

      await systemLog({
        event: 'delete',
        userId: session.user.id,
        entityId: ids.join(','),
        entityType: 'sports.category',
        description: 'Bulk sports categories deleted.',
        ipAddress: request.headers.get('x-forwarded-for') || '',
      }, tx);
    });

    return NextResponse.json({ message: 'Categories deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}


