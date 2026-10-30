import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper to convert BigInt to number safely
const jsonBigInt = (obj: any): any => {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
};

type CenterPerformanceData = {
  academyId: number;
  academyName: string;
  centerId: number;
  centerName: string;
  centerCode: string;
  studentCount: number;
  totalRevenue: number;
  platformOwnerRevenue: number; // Assuming 10% commission for platform owner
};

// GET: Fetch center performance and revenue summary
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Only owners can access this endpoint
    if (!tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Build where clause for locations
    const locationWhereClause: any = {
      isActive: true,
    };

    // Filter by tenant if provided
    if (tenantId) {
      const tenantIdNum = parseInt(tenantId);
      if (!isNaN(tenantIdNum)) {
        locationWhereClause.tenantId = tenantIdNum;
      }
    }

    // Get all active locations with tenant info
    const locations = await prisma.location.findMany({
      where: locationWhereClause,
      select: {
        id: true,
        centerName: true,
        centerCode: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
      orderBy: [
        { tenant: { academyName: 'asc' } },
        { centerName: 'asc' },
      ],
    });

    // Build payment where clause
    const paymentWhereClause: any = {
      location: {
        isActive: true,
        ...(tenantId ? { tenantId: parseInt(tenantId) } : {}),
      },
    };

    if (startDate || endDate) {
      paymentWhereClause.receivedAt = {};
      if (startDate) {
        paymentWhereClause.receivedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        paymentWhereClause.receivedAt.lte = endDateObj;
      }
    }

    // Get student counts per location
    const studentCounts = await prisma.student.groupBy({
      by: ['locationId'],
      where: {
        location: {
          isActive: true,
          ...(tenantId ? { tenantId: parseInt(tenantId) } : {}),
        },
        status: 'ACTIVE',
      },
      _count: {
        id: true,
      },
    });

    // Get payment totals per location
    const paymentTotals = await prisma.payment.groupBy({
      by: ['locationId'],
      where: paymentWhereClause,
      _sum: {
        amount: true,
      },
    });

    // Create maps for quick lookup
    const studentCountMap = new Map<number, number>();
    studentCounts.forEach((item) => {
      studentCountMap.set(item.locationId, item._count.id);
    });

    const paymentTotalMap = new Map<number, number>();
    paymentTotals.forEach((item) => {
      const amount = item._sum.amount;
      paymentTotalMap.set(
        item.locationId,
        amount ? Number(amount) : 0,
      );
    });

    // Combine data
    const reportData: CenterPerformanceData[] = locations.map((location) => {
      const studentCount = studentCountMap.get(location.id) || 0;
      const totalRevenue = paymentTotalMap.get(location.id) || 0;
      // Assuming 10% commission for platform owner (can be made configurable)
      const platformOwnerRevenue = totalRevenue * 0.1;

      return {
        academyId: location.tenantId,
        academyName: location.tenant.academyName,
        centerId: location.id,
        centerName: location.centerName,
        centerCode: location.centerCode,
        studentCount,
        totalRevenue,
        platformOwnerRevenue,
      };
    });

    // Calculate totals
    const totals = reportData.reduce(
      (acc, item) => ({
        totalStudents: acc.totalStudents + item.studentCount,
        totalRevenue: acc.totalRevenue + item.totalRevenue,
        totalPlatformOwnerRevenue:
          acc.totalPlatformOwnerRevenue + item.platformOwnerRevenue,
      }),
      {
        totalStudents: 0,
        totalRevenue: 0,
        totalPlatformOwnerRevenue: 0,
      },
    );

    return NextResponse.json(
      jsonBigInt({
        data: reportData,
        totals,
        summary: {
          totalCenters: reportData.length,
          totalAcademies: new Set(reportData.map((item) => item.academyId)).size,
        },
      }),
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

