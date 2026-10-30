import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// DELETE: Bulk delete employees
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

    // Check if user has permission to delete employees
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const employeeIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (employeeIds.length === 0) {
      return NextResponse.json(
        { message: 'No employee IDs provided' },
        { status: 400 },
      );
    }

    // Validate all IDs are numbers
    const validIds = employeeIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    if (validIds.length !== employeeIds.length) {
      return NextResponse.json(
        { message: 'Invalid employee IDs provided' },
        { status: 400 },
      );
    }

    // Check if all employees exist and belong to tenant
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        role: true,
        locationId: true,
      },
    });

    if (employees.length !== validIds.length) {
      return NextResponse.json(
        { message: 'Some employees not found or access denied' },
        { status: 404 },
      );
    }

    // Check if any employees are associated with batches (as coach)
    const batchCount = await prisma.batch.count({
      where: {
        coachId: { in: validIds },
      },
    });

    if (batchCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete employees. Some employees are associated with batches.' },
        { status: 400 },
      );
    }

    // Get user IDs to delete
    const userIds = employees
      .map(emp => emp.userId)
      .filter((id: string | null): id is string => id !== null);

    // Delete associated users first
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }

    // Delete employees
    const deleteResult = await prisma.employee.deleteMany({
      where: {
        id: { in: validIds },
        tenantId: tenantContext.tenantId,
      },
    });

    // Log the action for each deleted employee
    for (const employee of employees) {
      await systemLog({
        event: 'DELETE_EMPLOYEE_BULK',
        userId: tenantContext.user?.id || '',
        entityId: employee.id,
        entityType: 'EMPLOYEE',
        description: `Bulk deleted employee: ${employee.firstName} ${employee.lastName || ''}`.trim(),
        ipAddress: clientIp,
        meta: JSON.stringify({
          employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
          role: employee.role,
          locationId: employee.locationId,
          bulkDelete: true,
        }),
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} employees deleted successfully`,
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
