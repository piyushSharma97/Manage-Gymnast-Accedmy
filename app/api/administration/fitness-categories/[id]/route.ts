import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch a fitness category by ID
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
      return NextResponse.json({ message: 'Invalid category ID' }, { status: 400 });
    }

    const category = await prisma.fitnessCategory.findUnique({
      where: { id: numId },
    });
    if (!category) {
      return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// PUT: Update a fitness category
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
      return NextResponse.json({ message: 'Invalid category ID' }, { status: 400 });
    }

    const existing = await prisma.fitnessCategory.findUnique({
      where: { id: numId },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    if (name !== undefined && (!name || name.length > 500)) {
      return NextResponse.json(
        { message: 'Category name must be 1-500 characters' },
        { status: 400 },
      );
    }

    if (name !== undefined && name !== existing.name) {
      const duplicate = await prisma.fitnessCategory.findFirst({
        where: { name, id: { not: numId } },
      });
      if (duplicate) {
        return NextResponse.json(
          { message: 'A category with this name already exists' },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.fitnessCategory.update({
      where: { id: numId },
      data: {
        ...(name !== undefined ? { name } : {}),
        updatedBy: tenantContext.user.id,
      },
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'fitness.category',
      description: 'Fitness category updated.',
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

// DELETE: Delete a fitness category
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
      return NextResponse.json({ message: 'Invalid category ID' }, { status: 400 });
    }

    const existing = await prisma.fitnessCategory.findUnique({
      where: { id: numId },
      include: { _count: { select: { fitnessSkills: true } } },
    });
    if (!existing) {
      return NextResponse.json({ message: 'Category not found' }, { status: 404 });
    }
    if (existing._count.fitnessSkills > 0) {
      return NextResponse.json(
        { message: 'Cannot delete category that has skills. Remove or reassign skills first.' },
        { status: 400 },
      );
    }

    await prisma.fitnessCategory.delete({
      where: { id: numId },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'fitness.category',
      description: 'Fitness category deleted.',
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
