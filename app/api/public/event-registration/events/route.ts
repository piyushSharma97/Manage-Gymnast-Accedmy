import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EXTERNAL_EVENT_TYPE } from '@/lib/event-external';
import { isEventRegistrationOpen, resolveTenantForPublicRegistration } from '@/lib/public-external-event';

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenantForPublicRegistration(request);
    if (!tenant) {
      return NextResponse.json(
        { message: 'Invalid or missing academy. Open this page using your academy registration link.' },
        { status: 400 },
      );
    }

    const events = await prisma.event.findMany({
      where: {
        tenantId: tenant.id,
        event_type: EXTERNAL_EVENT_TYPE,
      },
      select: {
        id: true,
        name: true,
        description: true,
        fees: true,
        time: true,
        startdate: true,
        enddate: true,
        regstart_date: true,
        regend: true,
      },
      orderBy: [{ startdate: 'asc' }, { name: 'asc' }],
    });

    const payload = events
      .filter((e) => isEventRegistrationOpen(e))
      .map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        fees: e.fees,
        time: e.time,
        startdate: e.startdate,
        enddate: e.enddate,
      }));

    return NextResponse.json({
      academyName: tenant.academyName,
      events: payload,
    });
  } catch (e: unknown) {
    console.error('public event-registration events:', e);
    return NextResponse.json({ message: 'Unexpected error' }, { status: 500 });
  }
}
