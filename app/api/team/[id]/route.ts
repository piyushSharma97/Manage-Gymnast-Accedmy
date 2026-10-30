import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import {
  TeamSchema,
  TeamSchemaType,
} from '@/app/api/team/forms/team-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific team by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view teams
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const team = await prisma.team.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });

    if (!team) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    return NextResponse.json(team);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// PUT: Edit a specific team by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to edit teams
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const clientIp = getClientIP(request);

    // Ensure the ID is provided
    if (!id) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    // Check if record exists
    const existingTeam = await prisma.team.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });
    if (!existingTeam) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsedData = TeamSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    const { name, status } = parsedData.data as TeamSchemaType & { status?: string };

    // When status not provided (e.g. form only sends name), keep existing status
    const statusToUse = status ?? existingTeam.status;

    // Check uniqueness for name within the tenant
    const isUniqueTeam = await isUnique(
      'team',
      { name, tenantId: tenantContext.tenantId },
      { id },
    );
    if (!isUniqueTeam) {
      return NextResponse.json(
        { message: 'Team name must be unique within your organization.' },
        { status: 400 },
      );
    }

    // Update the team
    const updatedTeam = await prisma.team.update({
      where: { id: Number(id) },
      data: { name, status: statusToUse },
    });

    // Log the event
    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'team',
      description: 'Team updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedTeam);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// DELETE: Remove a specific team by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete teams
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const clientIp = getClientIP(request);

    if (!id) {
      return NextResponse.json(
        { message: 'Invalid input. Please check your data and try again.' },
        { status: 400 },
      );
    }

    // Check if the team exists
    const existingTeam = await prisma.team.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });
    if (!existingTeam) {
      return NextResponse.json(
        { message: 'Requested data not found.' },
        { status: 404 },
      );
    }

    // Perform deletion in a transaction to ensure atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete the team
      await tx.team.delete({
        where: { id: Number(id) },
      });

      // Log the event
      await systemLog(
        {
          event: 'delete',
          userId: tenantContext.user.id,
          entityId: id,
          entityType: 'team',
          description: 'Team deleted.',
          ipAddress: clientIp,
        },
        tx,
      );
    });

    return NextResponse.json({ message: 'Team deleted successfully.' });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
