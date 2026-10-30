import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch manager dashboard KPI stats (tenant + location scoped)
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

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Trials this month (at this location)
    const trialsThisMonth = await prisma.trial.count({
      where: {
        tenantId,
        locationId,
        trialDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
    });

    // New registrations this month (at this location)
    const newRegistrationsThisMonth = await prisma.student.count({
      where: {
        tenantId,
        locationId,
        joinDate: { gte: currentMonthStart, lte: currentMonthEnd },
      },
    });

    // Revenue this month (at this location)
    const revenueResult = await prisma.payment.aggregate({
      where: {
        tenantId,
        locationId,
        receivedAt: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amount: true },
    });
    const revenue = revenueResult._sum.amount ? Number(revenueResult._sum.amount) : 0;

    // Dropped last month: simplified for manager scope (students who went inactive in the previous month)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const droppedLastMonth = await prisma.student.count({
      where: {
        tenantId,
        locationId,
        status: 'INACTIVE',
        updatedAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    });

    const items = [
      { logo: 'userX', info: String(trialsThisMonth), desc: 'No. of Trials Taken' },
      { logo: 'user', info: String(newRegistrationsThisMonth), desc: 'New Registrations' },
      { logo: 'lineChart', info: String(droppedLastMonth), desc: 'Dropped Last Month' },
      { logo: 'dollarSign', info: String(revenue), desc: 'Revenue' },
    ];

    return NextResponse.json({ items });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch KPI stats' },
      { status: 500 },
    );
  }
}
