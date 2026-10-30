import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch all fitness categories
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 50);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'name';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const where = query
      ? { name: { contains: query } }
      : {};

    const total = await prisma.fitnessCategory.count({ where });
    const data =
      total > 0
        ? await prisma.fitnessCategory.findMany({
            skip,
            take: limit,
            where,
            orderBy: { [sortField]: sortDirection },
          })
        : [];

    return NextResponse.json({
      data,
      pagination: { total, page },
      empty: total === 0,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new fitness category
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const clientIp = getClientIP(request);
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 500) {
      return NextResponse.json(
        { message: 'Category name is required and must be 500 characters or less' },
        { status: 400 },
      );
    }

    const existing = await prisma.fitnessCategory.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { message: 'A category with this name already exists' },
        { status: 400 },
      );
    }

    const created = await prisma.fitnessCategory.create({
      data: {
        name,
        createdBy: tenantContext.user.id,
        updatedBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(created.id),
      entityType: 'fitness.category',
      description: 'Fitness category added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(created);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
