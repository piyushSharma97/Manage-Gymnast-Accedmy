import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch skill levels for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get('active');

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    // Return all skill levels; do not filter by sportsId
    const whereClause: any = {};

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    const skillLevels = await prisma.skillLevel.findMany({
      where: whereClause,
      select: {
        levelName: true,
      },
      orderBy: [
        { orderSequence: 'asc' },
        { levelName: 'asc' },
      ],
    });

    return NextResponse.json(skillLevels);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
