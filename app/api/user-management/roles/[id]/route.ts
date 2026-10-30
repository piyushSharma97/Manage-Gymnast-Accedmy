import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import {
  RoleSchema,
  RoleSchemaType,
} from '@/app/owner/user-management/roles/forms/role-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
// removed incorrect local type import; use Prisma return types instead

// GET: Fetch a specific role by ID, including permissions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }
    const numericId = Number((await params).id);
    const role = await prisma.userRole.findUnique({
      where: { id: numericId  },
      include: {
        permissions: {
          include: {
            permission: true, // Fetch full permission details
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ message: 'Role not found' }, { status: 404 });
    }

    // Map permissions to a flat structure
    const permissions = role.permissions.map((p) => p.permission);

    return NextResponse.json({ ...role, permissions });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// PUT: Edit a specific role by ID
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }

    // Await the params to resolve correctly
    const { params } = context;
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    // Check if record exists
    const existingCategory = await prisma.userRole.findUnique({
      where: { id: Number(id)},
    });
    if (!existingCategory) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    const body = await request.json();

    const parsedData = RoleSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { message: 'Invalid input. Please check your data and try again.' },
        { status: 400 }, // Bad Request
      );
    }

    const { name, slug, description, permissions }: RoleSchemaType =
      parsedData.data;

    // Check uniqueness for name and slug
    const isUniqueRole = await isUnique('userRole', { slug, name }, { id });
    if (!isUniqueRole) {
      return NextResponse.json(
        { message: 'Name or slug must be unique' },
        { status: 400 },
      );
    }

    // Perform database operations in a transaction
    const updatedRole = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Update role details
        const role = await tx.userRole.update({
          where: { id : Number(id)},
          data: { name, slug, description },
        });

        // Remove existing permissions regardless of whether `permissions` is empty or not
        await tx.userRolePermission.deleteMany({
          where: { roleId: Number(id) },
        });

        // Add new permissions if provided
        if (permissions && permissions?.length > 0) {
          const newPermissions = permissions.map((permissionId: string | number) => ({
            roleId: Number(id),
            permissionId: Number(permissionId),
          }));

          await tx.userRolePermission.createMany({ data: newPermissions });
        }

        return role;
      },
    );

    return NextResponse.json(updatedRole);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// DELETE: Remove a specific role by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }

    const clientIp = getClientIP(request);
    const { id } = await params;

    // Check if id passed
    if (!id) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    // Check if record exists
    const existingCategory = await prisma.userRole.findUnique({
      where: { id: Number(id) },
    });
    if (!existingCategory) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    // Check if the role exists
    const role = await prisma.userRole.findUnique({
      where: { id: Number(id) },
    });

    if (!role) {
      return NextResponse.json({ message: 'Role not found' }, { status: 404 });
    }

    
    // Check if the role is assigned to any user
    const roleAssignedToUsers = await prisma.user.count({
      where: { roleId: Number(id) },
    });

    if (roleAssignedToUsers > 0) {
      return NextResponse.json(
        { message: 'Role is assigned to users and cannot be deleted' },
        { status: 403 },
      );
    }

    // Delete the role and its associated permissions in a transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete linked role permissions
      await tx.userRolePermission.deleteMany({
        where: { roleId: Number(id) },
      });

      // Delete the permission itself
      await tx.userRole.delete({
        where: { id: Number(id) },
      });

      // Log the event
      await systemLog(
        {
          event: 'delete',
          userId: session.user.id,
          entityId: id,
          entityType: 'user.role',
          description: 'User role deleted.',
          ipAddress: clientIp,
        },
        tx,
      );
    });

    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
