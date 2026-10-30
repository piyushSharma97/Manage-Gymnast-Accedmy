import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch courses for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');
  const sportCategoryId = searchParams.get('sportCategoryId');
  const isActive = searchParams.get('active');
  const paymentCycle = searchParams.get('paymentCycle');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view courses
    if (!tenantContext.isOwner && !tenantContext.isAdmin && !tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const whereClause: any = {
      tenantId: tenantContext.tenantId,
    };

    if (programId) {
      whereClause.programId = parseInt(programId);
    }

    if (sportCategoryId) {
      whereClause.sportCategoryId = parseInt(sportCategoryId);
    }

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        courseName: true,
        courseCode: true,
        classFrequency: true,
        isActive: true,
        programId: true,
        sportCategoryId: true,
        perClass: true,
        monthly: true,
        quarterly: true,
        halfYearly: true,
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
      orderBy: [
        { programId: 'asc' },
        { courseName: 'asc' },
      ],
    });

    // Map courses to include the fee amount based on payment cycle
    const coursesWithFee = courses.map((course) => {
      let feeAmount: number | null = null;
      if (paymentCycle === 'perClass') {
        feeAmount = course.perClass ? Number(course.perClass) : null;
      } else if (paymentCycle === 'monthly') {
        feeAmount = course.monthly ? Number(course.monthly) : null;
      } else if (paymentCycle === 'quarterly') {
        feeAmount = course.quarterly ? Number(course.quarterly) : null;
      } else if (paymentCycle === 'halfYearly') {
        feeAmount = course.halfYearly ? Number(course.halfYearly) : null;
      }

      return {
        ...course,
        feeAmount,
      };
    });

    return NextResponse.json(coursesWithFee);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
