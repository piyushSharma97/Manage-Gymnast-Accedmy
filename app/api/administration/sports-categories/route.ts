import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch all sports categories
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const skip = (page - 1) * limit;

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const whereClause: any = {
      AND: [
        {
          categoryName: {
            contains: query,
          },
        },
        {
          deletedAt: null, // Only show non-deleted categories
        },
      ],
    };

    if (isActive === 'true' || isActive === 'false') {
      whereClause.AND.push({ isActive: isActive === 'true' });
    }

    // Count total records matching the filter
    const total = await prisma.sportsCategory.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.sportsCategory.count();
      isTableEmpty = overallTotal === 0;
    }

    const categories =
      total > 0
        ? await prisma.sportsCategory.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
          })
        : [];

    return NextResponse.json({
      data: categories,
      pagination: {
        total,
        page,
      },
      empty: isTableEmpty,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new sports category
export async function POST(request: NextRequest) {
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

    const categoryName = typeof body?.categoryName === 'string' ? body.categoryName.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

    if (!categoryName || categoryName.length > 50) {
      return NextResponse.json(
        { message: 'Invalid categoryName' },
        { status: 400 },
      );
    }

    // Ensure the category name is unique (app-level uniqueness)
    const uniqueName = await isUnique('sportsCategory', { categoryName });
    if (!uniqueName) {
      return NextResponse.json(
        { message: 'Category name must be unique' },
        { status: 400 },
      );
    }

    const newCategory = await prisma.sportsCategory.create({
      data: {
        categoryName,
        description,
        isActive,
        createdBy: session.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: session.user.id,
      entityId: String(newCategory.id),
      entityType: 'sports.category',
      description: 'Sports category added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newCategory);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}


