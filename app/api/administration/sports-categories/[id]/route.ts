import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// GET: Fetch a specific sports category by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;

    const category = await prisma.sportsCategory.findUnique({ where: { id: Number(id) } });
    if (!category || category.deletedAt) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    return NextResponse.json(category);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// PUT: Edit a specific sports category by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const clientIp = getClientIP(request);

    if (!id) {
      return NextResponse.json({ message: 'Invalid input.' }, { status: 400 });
    }

    const existing = await prisma.sportsCategory.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const categoryName = typeof body?.categoryName === 'string' ? body.categoryName.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : existing.isActive;

    if (!categoryName || categoryName.length > 50) {
      return NextResponse.json({ message: 'Invalid categoryName' }, { status: 400 });
    }

    const uniqueName = await isUnique('sportsCategory', { categoryName }, { id });
    if (!uniqueName) {
      return NextResponse.json({ message: 'Category name must be unique' }, { status: 400 });
    }

    const updated = await prisma.sportsCategory.update({
      where: { id: Number(id) },
      data: { categoryName, description, isActive, updatedBy: session.user.id },
    });

    await systemLog({
      event: 'update',
      userId: session.user.id,
      entityId: id,
      entityType: 'sports.category',
      description: 'Sports category updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// DELETE: Remove a specific sports category by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized request' }, { status: 401 });
    }

    const { id } = await params;
    const clientIp = getClientIP(request);

    if (!id) {
      return NextResponse.json(
        { message: 'Invalid input. Please check your data and try again.' },
        { status: 400 },
      );
    }

    // Check if category exists and is not already deleted
    const existing = await prisma.sportsCategory.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    if (existing.deletedAt) {
      return NextResponse.json(
        { message: 'Category is already deleted.' },
        { status: 400 },
      );
    }

    // Soft delete: set deletedAt instead of actually deleting
    await prisma.sportsCategory.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date(), updatedBy: session.user.id },
    });

    await systemLog({
      event: 'delete',
      userId: session.user.id,
      entityId: id,
      entityType: 'sports.category',
      description: 'Sports category deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Category deleted successfully.' });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}


