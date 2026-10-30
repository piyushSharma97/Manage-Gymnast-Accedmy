import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { listAtRiskStudents } from '@/lib/ai/at-risk';

export async function GET(request: NextRequest) {
  const tenantContext = await getTenantContext(request);
  if (
    !tenantContext?.tenantId ||
    (!tenantContext.isAdmin && !tenantContext.isManager && !tenantContext.isCoach)
  ) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const locationId =
    tenantContext.isCoach && tenantContext.locationId
      ? tenantContext.locationId
      : undefined;

  const result = await listAtRiskStudents({
    tenantId: tenantContext.tenantId,
    locationId,
  });

  return NextResponse.json(result);
}
