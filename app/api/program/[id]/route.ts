import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import {
  ProgramSchema,
  ProgramSchemaType,
} from '@/app/api/program/forms/program-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Fetch a specific program by ID
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

    // Check if user has permission to view programs
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const program = await prisma.program.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });

    if (!program) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    return NextResponse.json(program);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// PUT: Edit a specific program by ID
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

    // Check if user has permission to edit programs
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
    const existingProgram = await prisma.program.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });
    if (!existingProgram) {
      return NextResponse.json(
        { message: 'Record not found. Someone might have deleted it already.' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const parsedData = ProgramSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json({ error: 'Invalid input.' }, { status: 400 });
    }

    const { name, code, description, ageMin, ageMax, durationWeeks, sessionType, isActive }: ProgramSchemaType = parsedData.data;

    // Check uniqueness for name within the tenant
    const isUniqueProgram = await isUnique(
      'program',
      { name, tenantId: tenantContext.tenantId },
      { id: Number(id) },
    );
    if (!isUniqueProgram) {
      return NextResponse.json(
        { message: 'Program name must be unique within your organization.' },
        { status: 400 },
      );
    }

    // If code is provided, check uniqueness for code within the tenant
    if (code) {
      const isUniqueCode = await isUnique(
        'program',
        { code, tenantId: tenantContext.tenantId },
        { id: Number(id) },
      );
      if (!isUniqueCode) {
        return NextResponse.json(
          { message: 'Program code must be unique within your organization.' },
          { status: 400 },
        );
      }
    }

    // Update the program
    const updatedProgram = await prisma.program.update({
      where: { id: Number(id) },
      data: { 
        name, 
        code,
        description,
        ageMin,
        ageMax,
        durationWeeks,
        sessionType,
        isActive,
        updatedBy: tenantContext.user.id,
      },
    });

    // Log the event
    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: id,
      entityType: 'program',
      description: 'Program updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(updatedProgram);
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}

// DELETE: Remove a specific program by ID
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

    // Check if user has permission to delete programs
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

    // Check if the program exists
    const existingProgram = await prisma.program.findFirst({
      where: { 
        id: Number(id),
        tenantId: tenantContext.tenantId,
      },
    });
    if (!existingProgram) {
      return NextResponse.json(
        { message: 'Requested data not found.' },
        { status: 404 },
      );
    }

    // Check if program has related records (courses, batches, enrollments)
    const relatedRecords = await prisma.program.findFirst({
      where: { id: Number(id) },
      include: {
        courses: true,
        batches: true,
        enrollments: true,
      },
    });

    if (relatedRecords && (relatedRecords.courses.length > 0 || relatedRecords.batches.length > 0 || relatedRecords.enrollments.length > 0)) {
      return NextResponse.json(
        { message: 'Cannot delete program. It has associated courses, batches, or enrollments.' },
        { status: 400 },
      );
    }

    // Perform deletion in a transaction to ensure atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete the program
      await tx.program.delete({
        where: { id: Number(id) },
      });

      // Log the event
      await systemLog(
        {
          event: 'delete',
          userId: tenantContext.user.id,
          entityId: id,
          entityType: 'program',
          description: 'Program deleted.',
          ipAddress: clientIp,
        },
        tx,
      );
    });

    return NextResponse.json({ message: 'Program deleted successfully.' });
  } catch {
    return NextResponse.json(
      { message: 'Oops! Something went wrong. Please try again in a moment.' },
      { status: 500 },
    );
  }
}
