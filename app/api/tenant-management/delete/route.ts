import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// DELETE: Bulk delete tenants
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const tenantIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (tenantIds.length === 0) {
      return NextResponse.json(
        { message: 'No tenant IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = tenantIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== tenantIds.length) {
      return NextResponse.json(
        { message: 'Invalid tenant IDs provided' },
        { status: 400 },
      );
    }

    // Check if any tenants have associated users
    const usersCount = await prisma.user.count({
      where: { 
        tenantId: { 
          in: validIds 
        } 
      },
    });

    if (usersCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenants that have associated users' },
        { status: 400 },
      );
    }

    // Check if any tenants have associated students
    const studentsCount = await prisma.student.count({
      where: { 
        tenantId: { 
          in: validIds 
        } 
      },
    });

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenants that have associated students' },
        { status: 400 },
      );
    }

    // Check if any tenants have associated locations
    const locationsCount = await prisma.location.count({
      where: { 
        tenantId: { 
          in: validIds 
        } 
      },
    });

    if (locationsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete tenants that have associated locations' },
        { status: 400 },
      );
    }

    // Get tenant details for logging
    const tenantsToDelete = await prisma.tenant.findMany({
      where: { id: { in: validIds } },
      select: {
        id: true,
        academyName: true,
        academyCode: true,
      },
    });

    // Delete the tenants
    const deleteResult = await prisma.tenant.deleteMany({
      where: { id: { in: validIds } },
    });

    // Log the deletion
    for (const tenant of tenantsToDelete) {
      await systemLog({
        event: 'delete',
        userId: session.user.id,
        entityId: String(tenant.id),
        entityType: 'tenant',
        description: `Tenant deleted: ${tenant.academyName} (${tenant.academyCode})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} tenant(s) deleted successfully`,
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
