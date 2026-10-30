import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma'; // Adjust the import based on your Prisma setup
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

export async function DELETE(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete programs
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const { programIds } = body;

    if (!Array.isArray(programIds) || programIds.length === 0) {
      return NextResponse.json({ message: 'Invalid input.' }, { status: 400 });
    }

    // Validation: Limit deletion to a maximum of 2 records to ensure a smooth demo experience for users.
    if (programIds.length > 2) {
      return NextResponse.json(
        {
          message: 'You cannot delete more than 2 records at once.',
        },
        { status: 400 },
      );
    }

    // Check if any programs have related records before deletion
    const programsWithRelations = await prisma.program.findMany({
      where: {
        id: { in: programIds },
        tenantId: tenantContext.tenantId,
      },
      include: {
        courses: true,
        batches: true,
        enrollments: true,
      },
    });

    const programsWithRelationsList = programsWithRelations.filter(
      program => program.courses.length > 0 || program.batches.length > 0 || program.enrollments.length > 0
    );

    if (programsWithRelationsList.length > 0) {
      return NextResponse.json(
        { message: 'Cannot delete programs that have associated courses, batches, or enrollments.' },
        { status: 400 },
      );
    }

    // Perform deletion in a transaction to ensure atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete the programs (only those belonging to the tenant)
      await tx.program.deleteMany({
        where: {
          id: { in: programIds },
          tenantId: tenantContext.tenantId,
        },
      });

      // Log the event
      await systemLog(
        {
          event: 'delete',
          userId: tenantContext.user.id,
          entityId: programIds.join(', '),
          entityType: 'programs',
          description: 'Programs deleted.',
          ipAddress: clientIp,
        },
        tx,
      );
    });

    return NextResponse.json({
      message: 'Delete selected success',
    });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
