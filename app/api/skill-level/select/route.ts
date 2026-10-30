import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    if (!tenantContext.tenantId) {
      return NextResponse.json({ message: 'Tenant context required' }, { status: 400 });
    }

    // Return skill levels for the tenant, ordered by sequence
    // id: levelCode (legacy), numericId: DB id for employee skill level mapping
    type SkillLevelRow = {
      id: number;
      levelName: string;
      levelCode: string;
    };

    const rows = await prisma.$queryRawUnsafe<SkillLevelRow[]>(`
      SELECT id, levelName, levelCode 
      FROM skilllevel 
      WHERE isActive = 1 AND tenantId = ${tenantContext.tenantId}
      ORDER BY orderSequence ASC
    `);

    const levels = rows.map((r) => ({
      id: r.levelCode,
      numericId: r.id,
      levelName: r.levelName,
    }));
    return NextResponse.json(levels);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}


