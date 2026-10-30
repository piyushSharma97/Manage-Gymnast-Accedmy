import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch a specific fitness skill by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid fitness skill ID' },
        { status: 400 },
      );
    }

    const fitnessSkill = await prisma.fitnessSkill.findUnique({
      where: { id },
      include: {
        fitnessCategory: { select: { id: true, name: true } },
      },
    });

    if (!fitnessSkill) {
      return NextResponse.json(
        { message: 'Fitness skill not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(fitnessSkill);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a fitness skill
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid fitness skill ID' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const fitnessCategoryId = typeof body?.fitnessCategoryId === 'number' ? body.fitnessCategoryId : undefined;
    const unitOfMeasurement = typeof body?.unitOfMeasurement === 'string' ? body.unitOfMeasurement.trim() : undefined;

    const existing = await prisma.fitnessSkill.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Fitness skill not found' },
        { status: 404 },
      );
    }

    if (name !== undefined && (name.length === 0 || name.length > 200)) {
      return NextResponse.json(
        { message: 'Skill name must be 1-200 characters' },
        { status: 400 },
      );
    }

    if (unitOfMeasurement !== undefined && (unitOfMeasurement.length === 0 || unitOfMeasurement.length > 190)) {
      return NextResponse.json(
        { message: 'Unit of measurement must be 1-190 characters' },
        { status: 400 },
      );
    }

    const finalCategoryId = fitnessCategoryId ?? existing.fitnessCategoryId;
    if (fitnessCategoryId != null) {
      const category = await prisma.fitnessCategory.findUnique({
        where: { id: fitnessCategoryId },
      });
      if (!category) {
        return NextResponse.json(
          { message: 'Fitness category not found' },
          { status: 404 },
        );
      }
    }

    const finalName = name ?? existing.name;
    if (name !== existing.name || fitnessCategoryId !== undefined) {
      const duplicate = await prisma.fitnessSkill.findFirst({
        where: {
          name: finalName,
          fitnessCategoryId: finalCategoryId,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: 'A skill with this name already exists in this category' },
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedBy: tenantContext.user.id,
    };
    if (name !== undefined) updateData.name = name;
    if (fitnessCategoryId !== undefined) updateData.fitnessCategoryId = fitnessCategoryId;
    if (unitOfMeasurement !== undefined) updateData.unitOfMeasurement = unitOfMeasurement;

    const updated = await prisma.fitnessSkill.update({
      where: { id },
      data: updateData,
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updated.id),
      entityType: 'fitness.skill',
      description: 'Fitness skill updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a fitness skill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid fitness skill ID' },
        { status: 400 },
      );
    }

    const existing = await prisma.fitnessSkill.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Fitness skill not found' },
        { status: 404 },
      );
    }

    await prisma.fitnessSkill.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'fitness.skill',
      description: 'Fitness skill deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Fitness skill deleted successfully' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
