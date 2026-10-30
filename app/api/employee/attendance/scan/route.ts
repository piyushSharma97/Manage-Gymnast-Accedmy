import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { prisma } from '@/lib/prisma';
import { getClientIP } from '@/lib/api';

// POST: Record employee attendance by scanning QR code
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to record attendance
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const qrCode = typeof body?.qrCode === 'string' ? body.qrCode.trim() : '';
    const locationId = typeof body?.locationId === 'number' ? body.locationId : tenantContext.locationId;

    if (!qrCode) {
      return NextResponse.json(
        { message: 'QR code is required' },
        { status: 400 },
      );
    }

    // Parse QR code: employee-{id}-{tenantId}-{token}
    const qrCodeParts = qrCode.split('-');
    if (qrCodeParts.length < 4 || qrCodeParts[0] !== 'employee') {
      return NextResponse.json(
        { message: 'Invalid QR code format' },
        { status: 400 },
      );
    }

    const employeeId = parseInt(qrCodeParts[1]);
    const qrTenantId = parseInt(qrCodeParts[2]);

    if (isNaN(employeeId) || isNaN(qrTenantId)) {
      return NextResponse.json(
        { message: 'Invalid QR code data' },
        { status: 400 },
      );
    }

    // Verify tenant matches
    if (qrTenantId !== tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'QR code does not belong to this tenant' },
        { status: 403 },
      );
    }

    // Check if employee exists and is active
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: tenantContext.tenantId,
        isActive: true,
      },
      include: {
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: 'Employee not found or inactive' },
        { status: 404 },
      );
    }

    // Use provided locationId or employee's locationId
    const attendanceLocationId = locationId || employee.locationId;

    // Check if location exists and belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: attendanceLocationId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 },
      );
    }

    // Check if employee already has an open attendance (checked in but not checked out) today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingAttendance = await prisma.employeeAttendance.findFirst({
      where: {
        employeeId: employeeId,
        checkInTime: {
          gte: today,
          lt: tomorrow,
        },
        checkOutTime: null,
      },
    });

    if (existingAttendance) {
      // Employee is already checked in, check them out
      const updatedAttendance = await prisma.employeeAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          checkOutTime: new Date(),
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return NextResponse.json({
        message: 'Check-out recorded successfully',
        attendance: {
          id: updatedAttendance.id,
          employeeName: `${updatedAttendance.employee.firstName} ${updatedAttendance.employee.lastName || ''}`.trim(),
          checkInTime: updatedAttendance.checkInTime,
          checkOutTime: updatedAttendance.checkOutTime,
          type: 'checkout',
        },
      });
    } else {
      // Create new check-in record
      const newAttendance = await prisma.employeeAttendance.create({
        data: {
          employeeId: employeeId,
          tenantId: tenantContext.tenantId,
          locationId: attendanceLocationId,
          checkInTime: new Date(),
          qrCode: qrCode,
          createdBy: tenantContext.user?.id || '',
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return NextResponse.json({
        message: 'Check-in recorded successfully',
        attendance: {
          id: newAttendance.id,
          employeeName: `${newAttendance.employee.firstName} ${newAttendance.employee.lastName || ''}`.trim(),
          checkInTime: newAttendance.checkInTime,
          checkOutTime: newAttendance.checkOutTime,
          type: 'checkin',
        },
      }, { status: 201 });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

