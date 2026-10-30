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

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function normalizeToThisYear(month: number, day: number) {
  const now = new Date();
  const year = now.getFullYear();
  // Handle Feb 29: move to Feb 28 for non-leap years
  if (month === 2 && day === 29) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (!isLeap) return new Date(year, 1, 28);
  }
  return new Date(year, month - 1, day);
}

function inRangeBy(type: 'today' | 'week' | 'month', dob: Date | null): boolean {
  if (!dob) return false;
  const now = new Date();
  const m = dob.getMonth() + 1;
  const d = dob.getDate();
  if (type === 'today') {
    return m === now.getMonth() + 1 && d === now.getDate();
  }
  if (type === 'month') {
    return m === now.getMonth() + 1;
  }
  // week
  const thisYearBirthday = normalizeToThisYear(m, d);
  const start = startOfWeek(now);
  const end = endOfWeek(now);
  return thisYearBirthday >= start && thisYearBirthday <= end;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = (searchParams.get('query') || '').trim();
  const rangeRaw = (searchParams.get('range') || 'today').toLowerCase();
  const range = (['today', 'week', 'month'].includes(rangeRaw) ? rangeRaw : 'today') as 'today' | 'week' | 'month';
  const skip = (page - 1) * limit;
  const locationId = searchParams.get('locationId') || '';
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    // Base filters (tenant + dob not null + optional search)
    const whereClause: any = {
      AND: [
        { tenantId: tenantContext.tenantId },
        {locationId: locationId ? Number(locationId) : undefined},
        { dob: { not: null } },
      ],
    };
    if (query) {
      whereClause.AND.push({
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
          { registrationNo: { contains: query } },
        ],
      });
    }

    // Fetch minimal fields then filter/sort/paginate in memory for accurate birthday range
    const students = await prisma.student.findMany({
      where: whereClause,
      select: {
        id: true,
        registrationNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        gender: true,
        status: true,
        dob: true,
        createdAt: true,
      },
    });

    // Filter by range
    const filtered = students.filter((s) => inRangeBy(range, s.dob));

    // Sort by upcoming birthday within the current context (month->day), then by firstName
    const sorted = filtered.sort((a, b) => {
      const am = (a.dob ? a.dob.getMonth() : 0) + 1;
      const bm = (b.dob ? b.dob.getMonth() : 0) + 1;
      const ad = a.dob ? a.dob.getDate() : 0;
      const bd = b.dob ? b.dob.getDate() : 0;
      if (am !== bm) return am - bm;
      if (ad !== bd) return ad - bd;
      return (a.firstName || '').localeCompare(b.firstName || '');
    });

    const total = sorted.length;
    const paged = sorted.slice(skip, skip + limit);

    return NextResponse.json(
      jsonBigInt({
        data: paged,
        pagination: {
          total,
          page,
          limit,
          hasNext: skip + paged.length < total,
          hasPrev: page > 1,
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


