import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// GET: Get or generate QR code for employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid employee ID' },
        { status: 400 },
      );
    }

    // Check if employee exists and belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 },
      );
    }

    // Generate a unique QR code token for this employee
    // Format: employee-{id}-{tenantId}-{randomToken}
    const randomToken = crypto.randomBytes(16).toString('hex');
    const qrCodeData = `employee-${id}-${tenantContext.tenantId}-${randomToken}`;

    // Store the QR code in the employee's latest attendance record or create a new one
    // For simplicity, we'll return the QR code data that can be used to generate QR code
    // The QR code should be regenerated periodically for security

    return NextResponse.json({
      qrCode: qrCodeData,
      employeeId: id,
      employeeName: `${employee.firstName} ${employee.lastName || ''}`.trim(),
      // QR code expires in 24 hours
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

