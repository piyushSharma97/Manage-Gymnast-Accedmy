import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';
import { fetchYoutubeMetadata } from '@/lib/youtube-oembed';

/** Where clause for parent_youtube_link queries */
type ParentYoutubeLinkWhere = Record<string, unknown>;

// GET: Fetch all parent YouTube links
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const skip = (page - 1) * limit;

  try {
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const andConditions: ParentYoutubeLinkWhere[] = [];

    if (tenantContext.tenantId && !tenantContext.isOwner) {
      andConditions.push({ tenantId: tenantContext.tenantId });
    }

    if (query) {
      andConditions.push({
        OR: [
          { link: { contains: query } },
          { description: { contains: query } },
          { title: { contains: query } },
        ],
      });
    }

    const whereClause: ParentYoutubeLinkWhere =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const total = await prisma.parentYoutubeLink.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.parentYoutubeLink.count();
      isTableEmpty = overallTotal === 0;
    }

    const links =
      total > 0
        ? await prisma.parentYoutubeLink.findMany({
            skip,
            take: limit,
            where: whereClause,
            orderBy: {
              [sortField]: sortDirection,
            },
          })
        : [];

    return NextResponse.json({
      data: links,
      pagination: { total, page },
      empty: isTableEmpty,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new parent YouTube link
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    if (!tenantContext.tenantId) {
      return NextResponse.json(
        { message: 'Tenant ID is required' },
        { status: 400 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const link =
      typeof body?.link === 'string' ? body.link.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() : null;

    if (!link || link.length > 500) {
      return NextResponse.json(
        { message: 'YouTube link is required and must be 500 characters or less' },
        { status: 400 },
      );
    }

    let title: string | null = null;
    let thumbnailUrl: string | null = null;
    try {
      const metadata = await fetchYoutubeMetadata(link);
      title = metadata?.title ?? null;
      thumbnailUrl = metadata?.thumbnailUrl || null;
    } catch (metaErr) {
      console.warn('[parent-youtube-links] Failed to fetch YouTube metadata:', metaErr);
    }

    const newLink = (await prisma.parentYoutubeLink.create({
      data: {
        tenantId: tenantContext.tenantId,
        link,
        title,
        thumbnailUrl,
        description,
        createdBy: tenantContext.user.id,
      },
    })) as { id: number };

    await systemLog({
      event: 'create',
      userId: tenantContext.user.id,
      entityId: String(newLink.id),
      entityType: 'parent.youtube_link',
      description: 'Parent YouTube link added.',
      ipAddress: clientIp,
    });

    return NextResponse.json(newLink);
  } catch (error: unknown) {
    console.error('[parent-youtube-links] POST error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
