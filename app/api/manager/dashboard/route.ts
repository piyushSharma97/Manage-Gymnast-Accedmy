import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch manager dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantContext.tenantId || !tenantContext.locationId) {
      return NextResponse.json(
        { message: 'Tenant and location context required' },
        { status: 400 },
      );
    }

    const tenantId = tenantContext.tenantId;
    const locationId = tenantContext.locationId;

    // Get current month start and end dates
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 1. Active Students Count (at this location)
    const activeStudentsCount = await prisma.student.count({
      where: {
        tenantId,
        locationId,
        status: 'ACTIVE',
      },
    });

    // 2. Trials Taken This Month (at this location)
    const trialsThisMonth = await prisma.trial.count({
      where: {
        tenantId,
        locationId: locationId, // locationId can be nullable, but for managers we filter by their location
        trialDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    });

    // 3. New Registrations This Month (at this location)
    const newRegistrationsThisMonth = await prisma.student.count({
      where: {
        tenantId,
        locationId,
        joinDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    });

    // 4. Revenue This Month (at this location)
    const revenueResult = await prisma.payment.aggregate({
      where: {
        tenantId,
        locationId,
        receivedAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const revenue = revenueResult._sum.amount
      ? Number(revenueResult._sum.amount)
      : 0;

    // 5. Recent Activity (last 10 system logs for this tenant/location)
    // Note: SystemLog doesn't have locationId, so we'll filter by tenant context
    // We'll get logs related to students, trials, payments at this location
    const recentActivity = await prisma.systemLog.findMany({
      where: {
        userId: tenantContext.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Format recent activity
    const formattedActivity = recentActivity.map((log) => ({
      id: log.id,
      event: log.event,
      description: log.description,
      entityType: log.entityType,
      createdAt: log.createdAt,
      user: log.user,
    }));

    // 6. Additional stats: Pending Invoices
    const pendingInvoicesCount = await prisma.invoice.count({
      where: {
        tenantId,
        locationId,
        status: 'Pending',
      },
    });

    // 7. Upcoming Trials (next 7 days)
    const upcomingTrialsDate = new Date();
    upcomingTrialsDate.setDate(upcomingTrialsDate.getDate() + 7);
    const upcomingTrials = await prisma.trial.count({
      where: {
        tenantId,
        locationId: locationId, // locationId can be nullable, but for managers we filter by their location
        trialDate: {
          gte: new Date(),
          lte: upcomingTrialsDate,
        },
        isRegistered: false,
      },
    });

    // 8. Total Students (all statuses at this location)
    const totalStudents = await prisma.student.count({
      where: {
        tenantId,
        locationId,
      },
    });

    return NextResponse.json(
      jsonBigInt({
        stats: {
          activeStudents: activeStudentsCount,
          trialsThisMonth,
          newRegistrations: newRegistrationsThisMonth,
          revenue,
          pendingInvoices: pendingInvoicesCount,
          upcomingTrials,
          totalStudents,
        },
        recentActivity: formattedActivity,
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

