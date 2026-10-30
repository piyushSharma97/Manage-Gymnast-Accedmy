import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext, createTenantFilters } from '@/lib/api/tenant-helpers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'name';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  try {
    // Get tenant context
    const tenantContext = await getTenantContext(req);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Create tenant-aware filters
    const tenantFilters = createTenantFilters(tenantContext);
    
    const filters: Prisma.StudentWhereInput = {
      firstName: { contains: query },
      ...tenantFilters,
    };
    const totalCount = await prisma.student.count({ where: filters });

    const sortMap: Record<string, Prisma.StudentOrderByWithRelationInput> = {
      firstName: { firstName: sortDirection },
      id: { id: sortDirection },
    };

    const orderBy = sortMap[sortField] || { id: sortDirection };

    const students = await prisma.student.findMany({
      where: filters,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      select: {
        id: true,
        firstName: true,
        gender: true,
        email: true,
        phone: true,
        team: true,
        skilllevelName: true,
      },
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedStudents = students.map(student => ({
      ...student,
      id: student.id.toString()
    }));

    return NextResponse.json({
      data: serializedStudents,
      pagination: {
        total: totalCount,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error(err); // Add this to log actual error in server console
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
