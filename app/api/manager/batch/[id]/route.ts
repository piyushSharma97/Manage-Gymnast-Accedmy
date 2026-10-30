import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (obj: any) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch a specific batch by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view batches
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid batch ID' },
        { status: 400 },
      );
    }

    const batch = await prisma.batch.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        programId: true,
        courseId: true,
        studentId: true,
        paymentCycle: true,
        amount: true,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
        coachId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        course: {
          select: {
            id: true,
            courseName: true,
            courseCode: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
    });

    if (!batch) {
      return NextResponse.json(
        { message: 'Batch not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(jsonBigInt(batch));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific batch
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user has permission to update batches
    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id: idParam } = await params;
    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid batch ID' },
        { status: 400 },
      );
    }

    const body = await request.json();

    const programId = typeof body?.programId === 'number' ? body.programId : null;
    const courseId = typeof body?.courseId === 'number' ? body.courseId : null;
    const studentId = body?.studentId ? BigInt(body.studentId) : null;
    const coachId = typeof body?.coachId === 'number' ? body.coachId : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : null;
    const paymentCycle = typeof body?.paymentCycle === 'string' ? body.paymentCycle : null;
    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    // Day of week time fields (VarChar(20) in schema)
    const monday = typeof body?.monday === 'string' ? body.monday.trim().substring(0, 20) : null;
    const tuesday = typeof body?.tuesday === 'string' ? body.tuesday.trim().substring(0, 20) : null;
    const wednesday = typeof body?.wednesday === 'string' ? body.wednesday.trim().substring(0, 20) : null;
    const thursday = typeof body?.thursday === 'string' ? body.thursday.trim().substring(0, 20) : null;
    const friday = typeof body?.friday === 'string' ? body.friday.trim().substring(0, 20) : null;
    const saturday = typeof body?.saturday === 'string' ? body.saturday.trim().substring(0, 20) : null;
    const sunday = typeof body?.sunday === 'string' ? body.sunday.trim().substring(0, 20) : null;

    // Check if batch exists and belongs to tenant
    const existingBatch = await prisma.batch.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingBatch) {
      return NextResponse.json(
        { message: 'Batch not found' },
        { status: 404 },
      );
    }

    if (programId && programId <= 0) {
      return NextResponse.json(
        { message: 'Invalid programId' },
        { status: 400 },
      );
    }

    if (courseId && courseId <= 0) {
      return NextResponse.json(
        { message: 'Invalid courseId' },
        { status: 400 },
      );
    }

    if (studentId && studentId <= 0) {
      return NextResponse.json(
        { message: 'Invalid studentId' },
        { status: 400 },
      );
    }

    // If programId is provided, verify program exists and belongs to tenant
    if (programId) {
      const program = await prisma.program.findFirst({
        where: { 
          id: programId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!program) {
        return NextResponse.json(
          { message: 'Program not found or access denied' },
          { status: 400 },
        );
      }
    }

    // If courseId is provided, verify course exists and belongs to tenant
    let course: any = null;
    if (courseId) {
      course = await prisma.course.findFirst({
        where: { 
          id: courseId,
          tenantId: tenantContext.tenantId,
        },
        select: {
          id: true,
          perClass: true,
          monthly: true,
          quarterly: true,
          halfYearly: true,
        },
      });

      if (!course) {
        return NextResponse.json(
          { message: 'Course not found or access denied' },
          { status: 400 },
        );
      }
    }

    // If paymentCycle is provided, validate and calculate amount
    let amount: number | null = null;
    if (paymentCycle) {
      const validPaymentCycles = ['perClass', 'monthly', 'quarterly', 'halfYearly'];
      if (!validPaymentCycles.includes(paymentCycle)) {
        return NextResponse.json(
          { message: 'Valid payment cycle is required (perClass, monthly, quarterly, or halfYearly)' },
          { status: 400 },
        );
      }

      // If courseId is also provided, use that course; otherwise use existing batch's course
      const courseToUse = course || (await prisma.course.findFirst({
        where: { 
          id: existingBatch.courseId,
          tenantId: tenantContext.tenantId,
        },
        select: {
          id: true,
          perClass: true,
          monthly: true,
          quarterly: true,
          halfYearly: true,
        },
      }));

      if (!courseToUse) {
        return NextResponse.json(
          { message: 'Course not found for calculating amount' },
          { status: 400 },
        );
      }

      // Calculate amount based on payment cycle
      if (paymentCycle === 'perClass') {
        amount = courseToUse.perClass ? Number(courseToUse.perClass) : null;
      } else if (paymentCycle === 'monthly') {
        amount = courseToUse.monthly ? Number(courseToUse.monthly) : null;
      } else if (paymentCycle === 'quarterly') {
        amount = courseToUse.quarterly ? Number(courseToUse.quarterly) : null;
      } else if (paymentCycle === 'halfYearly') {
        amount = courseToUse.halfYearly ? Number(courseToUse.halfYearly) : null;
      }

      if (amount === null || amount < 0) {
        return NextResponse.json(
          { message: `Course does not have a valid ${paymentCycle} price configured` },
          { status: 400 },
        );
      }
    }

    // If studentId is provided, verify student exists and belongs to tenant
    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { 
          id: studentId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!student) {
        return NextResponse.json(
          { message: 'Student not found or access denied' },
          { status: 400 },
        );
      }
    }

    // If coachId is provided, verify coach exists and belongs to tenant
    if (coachId) {
      const coach = await prisma.employee.findFirst({
        where: { 
          id: coachId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!coach) {
        return NextResponse.json(
          { message: 'Coach not found or access denied' },
          { status: 400 },
        );
      }
    }

    // At least one day should have a time
    const hasTime = monday || tuesday || wednesday || thursday || friday || saturday || sunday;
    if (monday === null && tuesday === null && wednesday === null && thursday === null && 
        friday === null && saturday === null && sunday === null && 
        !existingBatch.monday && !existingBatch.tuesday && !existingBatch.wednesday && 
        !existingBatch.thursday && !existingBatch.friday && !existingBatch.saturday && !existingBatch.sunday) {
      // Only validate if all days are being cleared and there were no existing times
      return NextResponse.json(
        { message: 'At least one day of the week must have a time' },
        { status: 400 },
      );
    }

    const updateData: any = {};
    if (programId !== null) updateData.programId = programId;
    if (courseId !== null) updateData.courseId = courseId;
    if (studentId !== null) updateData.studentId = studentId;
    if (paymentCycle !== null) updateData.paymentCycle = paymentCycle;
    if (amount !== null) updateData.amount = amount;
    if (monday !== null) updateData.monday = monday || null;
    if (tuesday !== null) updateData.tuesday = tuesday || null;
    if (wednesday !== null) updateData.wednesday = wednesday || null;
    if (thursday !== null) updateData.thursday = thursday || null;
    if (friday !== null) updateData.friday = friday || null;
    if (saturday !== null) updateData.saturday = saturday || null;
    if (sunday !== null) updateData.sunday = sunday || null;
    if (coachId !== null) updateData.coachId = coachId;
    if (isActive !== null) updateData.isActive = isActive;
    updateData.updatedBy = tenantContext.user.id;

    const updatedBatch = await prisma.batch.update({
      where: { id },
      data: updateData as any,
      include: {
        program: {
          select: {
            id: true,
            name: true,
          },
        },
        course: {
          select: {
            id: true,
            courseName: true,
            courseCode: true,
          },
        },
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
      },
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: String(updatedBatch.id),
      entityType: 'batch',
      description: 'Batch updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(updatedBatch));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific batch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete batches
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid batch ID' },
        { status: 400 },
      );
    }

    // Check if batch exists and belongs to tenant
    const existingBatch = await prisma.batch.findFirst({
      where: { 
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingBatch) {
      return NextResponse.json(
        { message: 'Batch not found' },
        { status: 404 },
      );
    }

    // Check if batch is being used by enrollments
    const enrollmentsCount = await prisma.enrollment.count({
      where: { batchId: id },
    });

    if (enrollmentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete batch that has associated enrollments' },
        { status: 400 },
      );
    }

    // Check if batch is being used by invoices
    const invoicesCount = await prisma.invoice.count({
      where: { batchId: id },
    });

    if (invoicesCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete batch that has associated invoices' },
        { status: 400 },
      );
    }

    await prisma.batch.delete({
      where: { id },
    });

    await systemLog({
      event: 'delete',
      userId: tenantContext.user.id,
      entityId: String(id),
      entityType: 'batch',
      description: 'Batch deleted.',
      ipAddress: clientIp,
    });

    return NextResponse.json({ message: 'Batch deleted successfully' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
