import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

type FitnessSkillSelect = { id: number; name: string };

// DELETE: Bulk delete fitness skills
export async function DELETE(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const ids = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { message: 'No fitness skill IDs provided' },
        { status: 400 },
      );
    }

    const validIds = ids.filter(
      (id: unknown): id is number =>
        typeof id === 'number' && id > 0,
    );

    if (validIds.length !== ids.length) {
      return NextResponse.json(
        { message: 'Invalid fitness skill IDs provided' },
        { status: 400 },
      );
    }

    const skillsToDelete = (await prisma.fitnessSkill.findMany({
      where: { id: { in: validIds } },
      select: { id: true, name: true },
    })) as FitnessSkillSelect[];

    const deleteResult = await prisma.fitnessSkill.deleteMany({
      where: { id: { in: validIds } },
    });

    for (const skill of skillsToDelete) {
      await systemLog({
        event: 'delete',
        userId: tenantContext.user.id,
        entityId: String(skill.id),
        entityType: 'fitness.skill',
        description: `Fitness skill deleted: ${skill.name}`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} fitness skill(s) deleted successfully`,
      deletedCount: deleteResult.count,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
