import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch tenants for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActive = searchParams.get('active');
  const subscriptionStatus = searchParams.get('subscriptionStatus');

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const whereClause: any = {};

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    if (subscriptionStatus) {
      whereClause.subscriptionStatus = subscriptionStatus;
    }

    const tenants = await prisma.tenant.findMany({
      where: whereClause,
      select: {
        id: true,
        academyName: true,
        academyCode: true,
        primaryEmail: true,
        city: true,
        state: true,
        country: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionPlan: {
          select: {
            id: true,
            planName: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { academyName: 'asc' },
      ],
    });

    return NextResponse.json(tenants);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
