import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch subscription plans for dropdown/select options
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

    const whereClause: any = {};

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    const subscriptionPlans = await prisma.subscriptionPlan.findMany({
      where: whereClause,
      select: {
        id: true,
        planName: true,
        planCode: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        maxCenters: true,
        maxStudentsPerCenter: true,
        maxStaffPerCenter: true,
        isActive: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { planName: 'asc' },
      ],
    });

    return NextResponse.json(subscriptionPlans);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
