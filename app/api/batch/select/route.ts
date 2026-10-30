import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch batches for dropdown/select options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('programId');
  const courseId = searchParams.get('courseId');
  const coachId = searchParams.get('coachId');
  const isActive = searchParams.get('active');

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view batches
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
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

    if (courseId) {
      whereClause.courseId = parseInt(courseId);
    }

    if (coachId) {
      whereClause.coachId = parseInt(coachId);
    }

    if (isActive === 'true' || isActive === 'false') {
      whereClause.isActive = isActive === 'true';
    }

    const batches = await prisma.batch.findMany({
      where: whereClause,
      select: {
        id: true,
        isActive: true,
        programId: true,
        courseId: true,
        coachId: true,
        locationId: true,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        course: {
          select: {
            id: true,
            courseName: true,
            courseCode: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
        { courseId: 'asc' },
        { id: 'asc' },
      ],
    });

    return NextResponse.json(batches);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
