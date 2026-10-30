// File: app/api/dashboard/earnings/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59Z`);

    // Get all fees deposited this year
    const earnings = await prisma.payment.findMany({
      where: {
        receivedAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      select: {
        receivedAt: true,
        amount: true,
      },
    });

    // Initialize an array with 12 zeroes (Jan to Dec)
    const monthlyEarnings: number[] = Array(12).fill(0);

    earnings.forEach((entry) => {
      const monthIndex = new Date(entry.receivedAt).getMonth(); // 0 = Jan
      monthlyEarnings[monthIndex] += entry.amount.toNumber();
    });

    return NextResponse.json({ data: monthlyEarnings });
  } catch (error) {
    console.error('[GET /api/dashboard/earnings] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch earnings data' }, { status: 500 });
  }
}
