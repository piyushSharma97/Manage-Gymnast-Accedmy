import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch a grading criterion by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(_request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    const criterion = await prisma.fitnessGradingCriteria.findUnique({
      where: { id: numId },
      include: {
        fitnessSkill: { select: { id: true, name: true, unitOfMeasurement: true } },
      },
    });
    if (!criterion) {
      return NextResponse.json({ message: 'Grading criterion not found' }, { status: 404 });
    }

    return NextResponse.json(criterion);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// PUT: Update a grading criterion
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    const existing = await prisma.fitnessGradingCriteria.findUnique({
      where: { id: numId },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Grading criterion not found' }, { status: 404 });
    }

    const body = await request.json();
    const level = typeof body?.level === 'string' ? body.level.trim() : undefined;
    const description = typeof body?.description === 'string' ? body.description.trim() : body?.description === null ? null : undefined;
    const targetValue = typeof body?.targetValue === 'string' ? body.targetValue.trim() : body?.targetValue === null ? null : undefined;

    if (level !== undefined && (!level || level.length > 200)) {
      return NextResponse.json(
        { message: 'Level must be 1-200 characters' },
        { status: 400 },
      );
    }

    if (level !== undefined && level !== existing.level) {
      const duplicate = await prisma.fitnessGradingCriteria.findFirst({
        where: { fitnessSkillId: existing.fitnessSkillId, level, id: { not: numId } },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: 'A criterion with this level already exists for this skill' },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.fitnessGradingCriteria.update({
      where: { id: numId },
      data: {
        ...(level !== undefined ? { level } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(targetValue !== undefined ? { targetValue } : {}),
        updatedBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'fitness.gradingCriteria',
      description: 'Fitness grading criterion updated.',
      ipAddress: getClientIP(request),
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// DELETE: Delete a grading criterion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) {
      return NextResponse.json({ message: 'Invalid ID' }, { status: 400 });
    }

    const existing = await prisma.fitnessGradingCriteria.findUnique({
      where: { id: numId },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Grading criterion not found' }, { status: 404 });
    }

    await prisma.fitnessGradingCriteria.delete({
      where: { id: numId },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'fitness.gradingCriteria',
      description: 'Fitness grading criterion deleted.',
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ message: 'Grading criterion deleted successfully' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
