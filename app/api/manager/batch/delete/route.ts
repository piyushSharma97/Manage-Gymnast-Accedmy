import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete batches
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

    // Check if user has permission to delete batches
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const batchIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (batchIds.length === 0) {
      return NextResponse.json(
        { message: 'No batch IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = batchIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== batchIds.length) {
      return NextResponse.json(
        { message: 'Invalid batch IDs provided' },
        { status: 400 },
      );
    }

    // Check if any batches are being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { 
        batchId: { 
          in: validIds 
        } 
      },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete batches that have associated enrollments' },
        { status: 400 },
      );
    }

    // Check if any batches are being used by invoices
    const invoicesCount = await prisma.invoice.count({
      where: { 
        batchId: { 
          in: validIds 
        } 
      },
    });

    if (invoicesCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete batches that have associated invoices' },
        { status: 400 },
      );
    }

    // Get batch details for logging (only for batches belonging to the tenant)
    const batchesToDelete = await prisma.batch.findMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        course: {
          select: {
            courseName: true,
            courseCode: true,
          },
        },
      },
    });

    if (batchesToDelete.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some batches not found or access denied' },
        { status: 400 },
      );
    }

    // Delete the batches
    const deleteResult = await prisma.batch.deleteMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
    });

    // Log the deletion
    for (const batch of batchesToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(batch.id),
        entityType: 'batch',
        description: `Batch deleted: (${batch.course.courseName} - ${batch.course.courseCode})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} batch(es) deleted successfully`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
