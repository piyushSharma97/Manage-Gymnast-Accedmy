import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

export async function GET(request: Request) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as any);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    const programs = await prisma.program.findMany({
      where: {
        tenantId: tenantContext.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        ageMin: true,
        ageMax: true,
        durationWeeks: true,
        sessionType: true,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(programs);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
