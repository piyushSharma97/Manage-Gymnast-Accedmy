import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';

// GET: Get simplified list for dropdowns/select components
export async function GET(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext || (!tenantContext.isAdmin && !tenantContext.isOwner)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const registrations = await prisma.studentEventFee.findMany({
      where: {
        student: {
          tenantId: tenantContext.tenantId,
        },
      },
      select: {
        id: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            event_type: true,
          },
        },
        Status: true,
        Total: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = registrations.map((reg) => ({
      id: reg.id,
      studentId: reg.student.id.toString(),
      studentName: `${reg.student.firstName} ${reg.student.lastName}`,
      studentRegNo: reg.student.registrationNo,
      eventId: reg.event.id,
      eventName: reg.event.name,
      eventType: reg.event.event_type,
      status: reg.Status,
      total: Number(reg.Total),
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}