import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete locations
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

    // Check if user has permission to delete locations
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Ensure tenantId is available
    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Tenant context required' },
        { status: 400 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const locationIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (locationIds.length === 0) {
      return NextResponse.json(
        { message: 'No location IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = locationIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== locationIds.length) {
      return NextResponse.json(
        { message: 'Invalid location IDs provided' },
        { status: 400 },
      );
    }

    // Check if any locations are being used by students
    const studentsCount = await prisma.student.count({
      where: { 
        locationId: { 
          in: validIds 
        } 
      },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete locations that have associated students' },
        { status: 400 },
      );
    }

    // Check if any locations are being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { 
        locationId: { 
          in: validIds 
        } 
      },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete locations that have associated enrollments' },
        { status: 400 },
      );
    }

    // Check if any locations are being used by payments
    const paymentsCount = await prisma.payment.count({
      where: { 
        locationId: { 
          in: validIds 
        } 
      },
    });

    if (paymentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete locations that have associated payments' },
        { status: 400 },
      );
    }

    // Check if any locations are being used by users
    const usersCount = await prisma.user.count({
      where: { 
        locationId: { 
          in: validIds 
        } 
      },
    });

    if (usersCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete locations that have associated users' },
        { status: 400 },
      );
    }

    // Get location details for logging (only for locations belonging to the tenant)
    const locationsToDelete = await prisma.location.findMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        centerName: true,
        centerCode: true,
      },
    });

    if (locationsToDelete.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some locations not found or access denied' },
        { status: 400 },
      );
    }

    // Delete the locations
    const deleteResult = await prisma.location.deleteMany({
      where: { 
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
    });

    // Log the deletion
    for (const location of locationsToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(location.id),
        entityType: 'location',
        description: `Location deleted: ${location.centerName} (${location.centerCode})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} location(s) deleted successfully`,
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
