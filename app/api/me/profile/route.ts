import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true,
        tenant: true,
        location: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      role: user.role
        ? { slug: user.role.slug, name: user.role.name }
        : null,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            academyName: user.tenant.academyName,
            academyCode: user.tenant.academyCode,
            subscriptionStatus: user.tenant.subscriptionStatus,
          }
        : null,
      location: user.location
        ? {
            id: user.location.id,
            centerName: user.location.centerName,
            centerCode: user.location.centerCode,
            city: user.location.city,
            state: user.location.state,
            country: user.location.country,
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { message: 'Failed to load profile' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name =
      typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : undefined;
    const lastName =
      typeof body?.lastName === 'string'
        ? body.lastName.trim().slice(0, 100)
        : undefined;
    const avatar =
      typeof body?.avatar === 'string' && body.avatar.length > 0
        ? body.avatar.trim().slice(0, 500)
        : undefined;

    const data: { name?: string | null; lastName?: string | null; avatar?: string | null } =
      {};
    if (name !== undefined) data.name = name || null;
    if (lastName !== undefined) data.lastName = lastName || null;
    if (avatar !== undefined) data.avatar = avatar || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: 'No valid fields to update' },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...data,
        updatedBy: session.user.id,
      },
      include: {
        role: true,
        tenant: true,
        location: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      lastName: updated.lastName,
      email: updated.email,
      avatar: updated.avatar,
      status: updated.status,
      emailVerifiedAt: updated.emailVerifiedAt,
      role: updated.role
        ? { slug: updated.role.slug, name: updated.role.name }
        : null,
      tenant: updated.tenant
        ? {
            id: updated.tenant.id,
            academyName: updated.tenant.academyName,
            academyCode: updated.tenant.academyCode,
            subscriptionStatus: updated.tenant.subscriptionStatus,
          }
        : null,
      location: updated.location
        ? {
            id: updated.location.id,
            centerName: updated.location.centerName,
            centerCode: updated.location.centerCode,
            city: updated.location.city,
            state: updated.location.state,
            country: updated.location.country,
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { message: 'Failed to update profile' },
      { status: 500 },
    );
  }
}
