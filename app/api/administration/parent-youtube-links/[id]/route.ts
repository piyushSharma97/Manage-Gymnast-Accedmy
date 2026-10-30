import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext, validateResourceAccess } from '@/lib/api/tenant-helpers';
import { fetchYoutubeMetadata } from '@/lib/youtube-oembed';

/** Shape of ParentYoutubeLink from prisma */
type ParentYoutubeLinkRecord = {
  id: number;
  tenantId: number;
  link: string;
  title: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
};

// GET: Fetch a specific parent YouTube link by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid parent YouTube link ID' },
        { status: 400 },
      );
    }

    const record = (await prisma.parentYoutubeLink.findUnique({
      where: { id },
    })) as ParentYoutubeLinkRecord | null;

    if (!record) {
      return NextResponse.json(
        { message: 'Parent YouTube link not found' },
        { status: 404 },
      );
    }

    if (!validateResourceAccess(tenantContext, record.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    return NextResponse.json(record);
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a parent YouTube link
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid parent YouTube link ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const link =
      typeof body?.link === 'string' ? body.link.trim() : undefined;
    const description =
      typeof body?.description === 'string'
        ? body.description.trim()
        : body?.description === null
          ? null
          : undefined;

    const existing = (await prisma.parentYoutubeLink.findUnique({
      where: { id },
    })) as ParentYoutubeLinkRecord | null;

    if (!existing) {
      return NextResponse.json(
        { message: 'Parent YouTube link not found' },
        { status: 404 },
      );
    }

    if (!validateResourceAccess(tenantContext, existing.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    if (link !== undefined && (link.length === 0 || link.length > 500)) {
      return NextResponse.json(
        { message: 'Link must be 1–500 characters' },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {
      updatedBy: tenantContext.user.id,
    };
    if (link !== undefined) updateData.link = link;
    if (description !== undefined) updateData.description = description;

    if (link !== undefined) {
      const metadata = await fetchYoutubeMetadata(link);
      updateData.title = metadata?.title ?? null;
      updateData.thumbnailUrl = metadata?.thumbnailUrl || null;
    }

    const updated = (await prisma.parentYoutubeLink.update({
      where: { id },
      data: updateData,
    })) as ParentYoutubeLinkRecord;

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updated.id),
      entityType: 'parent.youtube_link',
      description: 'Parent YouTube link updated.',
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

// DELETE: Delete a parent YouTube link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid parent YouTube link ID' },
        { status: 400 },
      );
    }

    const existing = (await prisma.parentYoutubeLink.findUnique({
      where: { id },
    })) as ParentYoutubeLinkRecord | null;

    if (!existing) {
      return NextResponse.json(
        { message: 'Parent YouTube link not found' },
        { status: 404 },
      );
    }

    if (!validateResourceAccess(tenantContext, existing.tenantId)) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 },
      );
    }

    await prisma.parentYoutubeLink.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'parent.youtube_link',
      description: 'Parent YouTube link deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Parent YouTube link deleted successfully' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: (error as Error)?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
