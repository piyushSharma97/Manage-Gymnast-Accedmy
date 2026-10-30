import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// Helper: safely serialize BigInt values for JSON responses
const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch all trials
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isRegistered = searchParams.get('registered');
  const type = searchParams.get('type');
  const gender = searchParams.get('gender');
  const skip = (page - 1) * limit;

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
      AND: [
        {
          tenantId: tenantContext.tenantId,
        },
        {
          OR: [
            {
              participantName: {
                contains: query,
              },
            },
            {
              parentName: {
                contains: query,
              },
            },
            {
              email: {
                contains: query,
              },
            },
            {
              phone: {
                contains: query,
              },
            },
          ],
        },
      ],
    };

    if (isRegistered === 'true' || isRegistered === 'false') {
      whereClause.AND.push({ isRegistered: isRegistered === 'true' });
    }

    if (type) {
      whereClause.AND.push({ type: { contains: type } });
    }

    if (gender) {
      whereClause.AND.push({ gender: gender });
    }

    // Count total records matching the filter
    const total = await prisma.trial.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.trial.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    const trials =
      total > 0
        ? await prisma.trial.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
            include: {
              tenant: {
                select: {
                  id: true,
                  academyName: true,
                },
              },
            },
          })
        : [];

    return NextResponse.json(
      jsonBigInt({
        data: trials,
        pagination: {
          total,
          page,
        },
        empty: isTableEmpty,
      }),
    );
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// POST: Add a new trial
export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create trials
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const participantName = typeof body?.participantName === 'string' ? body.participantName.trim() : '';
    const parentName = typeof body?.parentName === 'string' ? body.parentName.trim() : null;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null;
    const trialDate = typeof body?.trialDate === 'string' ? new Date(body.trialDate) : null;    
    const trialTime = typeof body?.trialTime === 'string' ? body.trialTime.trim() : null;
    const gender = typeof body?.gender === 'string' ? body.gender : null;
    const isRegistered = typeof body?.isRegistered === 'boolean' ? body.isRegistered : false;
    const email = typeof body?.email === 'string' ? body.email.trim() : null;
    const type = typeof body?.type === 'string' ? body.type.trim() : null;
    const age = typeof body?.age === 'number' ? body.age : null;
    const instructor = typeof body?.instructor === 'string' ? body.instructor.trim() : null;
    const other = typeof body?.other === 'string' ? body.other.trim() : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    if (!participantName || participantName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid participantName' },
        { status: 400 },
      );
    }

    if (parentName && parentName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid parentName' },
        { status: 400 },
      );
    }

    if (phone && phone.length > 20) {
      return NextResponse.json(
        { message: 'Invalid phone' },
        { status: 400 },
      );
    }

    if (!trialDate || isNaN(trialDate.getTime())) {
      return NextResponse.json(
        { message: 'Invalid trialDate' },
        { status: 400 },
      );
    }

    if (!trialTime || trialTime.length > 20) {
      return NextResponse.json(
        { message: 'Invalid trialTime' },
        { status: 400 },
      );
    }

    if (email && (email.length > 150 || !email.includes('@'))) {
      return NextResponse.json(
        { message: 'Invalid email' },
        { status: 400 },
      );
    }

    if (type && type.length > 50) {
      return NextResponse.json(
        { message: 'Invalid type' },
        { status: 400 },
      );
    }

    if (age && (age < 0 || age > 120)) {
      return NextResponse.json(
        { message: 'Invalid age' },
        { status: 400 },
      );
    }
   if(locationId === null){
      return NextResponse.json(
        { message: 'Invalid location' },
        { status: 400 },
      );
    }
    if (instructor && instructor.length > 100) {
      return NextResponse.json(
        { message: 'Invalid instructor' },
        { status: 400 },
      );
    }

    if (gender && !['Male', 'Female', 'Mixed'].includes(gender)) {
      return NextResponse.json(
        { message: 'Invalid gender' },
        { status: 400 },
      );
    }

    const newTrial = await prisma.trial.create({
      data: {
        tenantId: tenantContext.tenantId!,
        participantName,
        parentName,
        phone,
        trialDate,
        trialTime,
        gender: gender as any,
        isRegistered,
        email,
        type,
        age,
        instructor,
        other,
        locationId,
        createdBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newTrial.id),
      entityType: 'trial',
      description: 'Trial added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(newTrial));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
