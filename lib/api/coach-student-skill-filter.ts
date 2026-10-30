import { prisma } from '@/lib/prisma';
import type { TenantContext } from '@/lib/api/tenant-helpers';

/**
 * Pure coaches (not manager/admin/owner) only see students whose `skilllevelName`
 * matches one of their assigned SkillLevel rows (id as string, levelName, or levelCode).
 * Returns null when no coach-only filtering should be applied.
 */
export async function getCoachAllowedStudentSkillLevelValues(
  tenantContext: TenantContext,
): Promise<string[] | null> {
  const isPureCoach =
    tenantContext.isCoach &&
    !tenantContext.isManager &&
    !tenantContext.isAdmin &&
    !tenantContext.isOwner;
  if (!isPureCoach) return null;

  const tid = tenantContext.tenantId;
  if (tid == null) return [];

  const employeeWhere: {
    userId: string;
    tenantId: number;
    role: 'Coach';
    isActive: boolean;
    locationId?: number;
  } = {
    userId: tenantContext.user.id,
    tenantId: tid,
    role: 'Coach',
    isActive: true,
  };
  if (tenantContext.locationId != null) {
    employeeWhere.locationId = tenantContext.locationId;
  }

  const employee = await prisma.employee.findFirst({
    where: employeeWhere,
    include: {
      employeeSkillLevels: {
        include: {
          skillLevel: { select: { id: true, levelName: true, levelCode: true } },
        },
      },
    },
  });

  if (!employee) return [];

  const values = new Set<string>();
  for (const esl of employee.employeeSkillLevels) {
    values.add(String(esl.skillLevel.id));
    const ln = esl.skillLevel.levelName?.trim();
    const lc = esl.skillLevel.levelCode?.trim();
    if (ln) values.add(ln);
    if (lc) values.add(lc);
  }
  return Array.from(values);
}
