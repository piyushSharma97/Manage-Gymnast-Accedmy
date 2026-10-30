import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch trials for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const gender = searchParams.get('gender');
  const isRegistered = searchParams.get('registered');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {
      tenantId: tenantContext.tenantId,
    };

    if (type) {
      whereClause.type = { contains: type };
    }

    if (gender) {
      whereClause.gender = gender;
    }

    if (isRegistered === 'true' || isRegistered === 'false') {
      whereClause.isRegistered = isRegistered === 'true';
    }

    const trials = await prisma.trial.findMany({
      where: whereClause,
      select: {
        id: true,
        participantName: true,
        parentName: true,
        phone: true,
        email: true,
        trialDate: true,
        trialTime: true,
        gender: true,
        isRegistered: true,
        type: true,
        age: true,
        instructor: true,
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
      orderBy: [
        { trialDate: 'desc' },
        { participantName: 'asc' },
      ],
    });

    return NextResponse.json(jsonBigInt(trials));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
