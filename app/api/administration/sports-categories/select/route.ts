import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || ''; // Extract search query

  try {
    // Validate user session
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }

    // Fetch users
    const sportscategory = await prisma.sportsCategory.findMany({
      select: {
        id: true,
        categoryName: true,
        description: true,
        isActive: true,
        createdBy: true,
        createdAt: true,
      },
      orderBy: {
        categoryName: 'asc',
      },
    });

    return NextResponse.json(sportscategory);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
