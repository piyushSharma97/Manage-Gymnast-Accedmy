import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import {
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  format,
  subWeeks,
  subMonths,
} from 'date-fns';

const jsonBigInt = (obj: any): any =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

export type ChartDataPoint = {
  period: string;
  label: string;
  revenue: number;
  platformOwnerRevenue: number;
  newStudents: number;
};

// GET: Time-series data for Academy charts (by week or month)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupBy = (searchParams.get('groupBy') || 'month') as 'week' | 'month';
  const tenantIdParam = searchParams.get('tenantId');
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  try {
    const tenantContext = await getTenantContext(request as NextRequest);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!tenantContext.isOwner) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (startDateParam && endDateParam) {
      start = new Date(startDateParam);
      end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
    } else if (groupBy === 'week') {
      end = new Date(now);
      start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 11); // last 12 weeks
    } else {
      end = new Date(now);
      start = subMonths(startOfMonth(now), 11); // last 12 months
    }

    const tenantId = tenantIdParam ? parseInt(tenantIdParam, 10) : undefined;
    const tenantFilter =
      tenantId && !isNaN(tenantId) ? { tenantId } : {};

    // Fetch payments in range
    const payments = await prisma.payment.findMany({
      where: {
        receivedAt: { gte: start, lte: end },
        location: { isActive: true, ...tenantFilter },
      },
      select: {
        receivedAt: true,
        amount: true,
      },
    });

    // New students per period (by createdAt)
    const students = await prisma.student.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...tenantFilter,
      },
      select: { createdAt: true },
    });

    const keyToLabel = (key: Date): string => {
      if (groupBy === 'week') {
        const weekStart = startOfWeek(key, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(key, { weekStartsOn: 1 });
        return `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM')}`;
      }
      return format(key, 'MMM yyyy');
    };

    const getBucketKey = (date: Date): Date => {
      const d = new Date(date);
      if (groupBy === 'week') return startOfWeek(d, { weekStartsOn: 1 });
      return startOfMonth(d);
    };

    type Bucket = {
      revenue: number;
      newStudents: number;
    };
    const buckets = new Map<string, Bucket>();

    const ensureBucket = (key: Date) => {
      const k = key.getTime().toString();
      if (!buckets.has(k)) {
        buckets.set(k, { revenue: 0, newStudents: 0 });
      }
      return buckets.get(k)!;
    };

    for (const p of payments) {
      const key = getBucketKey(p.receivedAt);
      const b = ensureBucket(key);
      b.revenue += Number(p.amount);
    }
    for (const s of students) {
      const key = getBucketKey(s.createdAt);
      const b = ensureBucket(key);
      b.newStudents += 1;
    }

    // Sort by period and build response with stable labels
    const sortedKeys = Array.from(buckets.keys())
      .map((k) => new Date(parseInt(k, 10)))
      .sort((a, b) => a.getTime() - b.getTime());

    const PLATFORM_OWNER_SHARE = 0.1;
    const data: ChartDataPoint[] = sortedKeys.map((key) => {
      const b = buckets.get(key.getTime().toString())!;
      return {
        period: key.toISOString(),
        label: keyToLabel(key),
        revenue: Math.round(b.revenue * 100) / 100,
        platformOwnerRevenue: Math.round(b.revenue * PLATFORM_OWNER_SHARE * 100) / 100,
        newStudents: b.newStudents,
      };
    });

    return NextResponse.json(
      jsonBigInt({
        data,
        groupBy,
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    );
  } catch (error: any) {
    console.error('Charts API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
