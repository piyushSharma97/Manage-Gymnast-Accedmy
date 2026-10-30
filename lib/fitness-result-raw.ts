/**
 * Raw SQL for `fitness_result` without requiring `event_id` / `tenant_id` columns.
 * Event + tenant are encoded in `level` as: EA|e000006|t000007|{categoryName}
 * (fixed-width ids so LIKE filters work). Category display still comes from join to fitness_categories.
 */
import type { PrismaClient } from '@prisma/client';

/** Prisma client or interactive transaction client */
type DbExec = Pick<PrismaClient, '$executeRawUnsafe' | '$queryRawUnsafe'>;

const LEVEL_MAX = 200;

export function padAssessmentId(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

/** Prefix used in SQL LIKE: EA|e000006|t000007| */
export function assessmentLevelLikePrefix(eventId: number, tenantId: number): string {
  return `EA|e${padAssessmentId(eventId)}|t${padAssessmentId(tenantId)}|`;
}

/** Full stored level value (truncated to DB limit) */
export function encodeAssessmentLevel(
  eventId: number,
  tenantId: number,
  categoryName: string,
): string {
  const prefix = assessmentLevelLikePrefix(eventId, tenantId);
  const rest = LEVEL_MAX - prefix.length;
  const cat = rest > 0 ? categoryName.slice(0, rest) : '';
  return `${prefix}${cat}`;
}

const ENCODED_LEVEL_RE = /^EA\|e(\d{6})\|t(\d{6})\|(.*)$/;

export function parseEncodedAssessmentLevel(level: string): {
  eventId: number;
  tenantId: number;
  categorySuffix: string;
} | null {
  const m = ENCODED_LEVEL_RE.exec(level);
  if (!m) return null;
  return {
    eventId: parseInt(m[1], 10),
    tenantId: parseInt(m[2], 10),
    categorySuffix: m[3] ?? '',
  };
}

export type FitnessResultJoinedRow = {
  id: number;
  gymnast_id: bigint;
  fitness_skill_id: number;
  achieved_value: string;
  remarks: string | null;
  date: Date;
  level: string;
  skill_name: string;
  category_name: string | null;
  unit_of_measurement: string | null;
};

const SELECT_JOINED = `
  SELECT fr.id,
         fr.gymnast_id,
         fr.fitness_skill_id,
         fr.achieved_value,
         fr.remarks,
         fr.date,
         fr.level,
         fs.name AS skill_name,
         fs.unit_of_measurement AS unit_of_measurement,
         fc.name AS category_name
  FROM fitness_result fr
  INNER JOIN fitness_skill fs ON fs.id = fr.fitness_skill_id
  LEFT JOIN fitness_categories fc ON fc.id = fr.fitness_categoryid
`;

/** Results for one student + fitness assessment event */
export async function fetchFitnessResultsStudentEvent(
  prisma: PrismaClient,
  studentId: bigint,
  eventId: number,
  tenantId: number,
): Promise<FitnessResultJoinedRow[]> {
  const prefix = assessmentLevelLikePrefix(eventId, tenantId);
  return prisma.$queryRawUnsafe<FitnessResultJoinedRow[]>(
    `${SELECT_JOINED}
   WHERE fr.gymnast_id = ? AND fr.level LIKE ?
   ORDER BY COALESCE(fc.name, '') ASC, fs.name ASC`,
    studentId,
    `${prefix}%`,
  );
}

/** All result rows for an event (optionally one student) — for graph / team average */
export async function fetchFitnessResultsForEvent(
  prisma: PrismaClient,
  eventId: number,
  tenantId: number,
  studentId?: bigint,
): Promise<FitnessResultJoinedRow[]> {
  const prefix = assessmentLevelLikePrefix(eventId, tenantId);
  if (studentId !== undefined) {
    return prisma.$queryRawUnsafe<FitnessResultJoinedRow[]>(
      `${SELECT_JOINED}
     WHERE fr.level LIKE ? AND fr.gymnast_id = ?
     ORDER BY fr.gymnast_id ASC, COALESCE(fc.name, '') ASC, fs.name ASC`,
      `${prefix}%`,
      studentId,
    );
  }
  return prisma.$queryRawUnsafe<FitnessResultJoinedRow[]>(
    `${SELECT_JOINED}
   WHERE fr.level LIKE ?
   ORDER BY fr.gymnast_id ASC, COALESCE(fc.name, '') ASC, fs.name ASC`,
    `${prefix}%`,
  );
}

/** Distinct student IDs (gymnast_id) that have a result for skill (+ optional event) */
export async function fetchStudentIdsWithFitnessSkill(
  prisma: PrismaClient,
  tenantId: number,
  fitnessSkillId: number,
  eventId?: number,
): Promise<bigint[]> {
  if (eventId != null && !Number.isNaN(eventId)) {
    const prefix = assessmentLevelLikePrefix(eventId, tenantId);
    const rows = await prisma.$queryRawUnsafe<{ gymnast_id: bigint }[]>(
      `SELECT DISTINCT gymnast_id FROM fitness_result
       WHERE fitness_skill_id = ? AND level LIKE ?`,
      fitnessSkillId,
      `${prefix}%`,
    );
    return rows.map((r) => r.gymnast_id);
  }
  const likeTenant = `EA|e%|t${padAssessmentId(tenantId)}|%`;
  const rows = await prisma.$queryRawUnsafe<{ gymnast_id: bigint }[]>(
    `SELECT DISTINCT gymnast_id FROM fitness_result
     WHERE fitness_skill_id = ? AND level LIKE ?`,
    fitnessSkillId,
    likeTenant,
  );
  return rows.map((r) => r.gymnast_id);
}

export type PastEventKeyRow = {
  event_id: number;
  assessment_day: Date;
  last_ts: Date;
};

export async function fetchPastAssessmentEventKeys(
  prisma: PrismaClient,
  studentId: bigint,
  tenantId: number,
  limit: number,
): Promise<PastEventKeyRow[]> {
  const likeTenant = `EA|e%|t${padAssessmentId(tenantId)}|%`;
  const rows = await prisma.$queryRawUnsafe<{ level: string; date: Date }[]>(
    `SELECT level, date FROM fitness_result
     WHERE gymnast_id = ? AND level LIKE ?
     ORDER BY date DESC
     LIMIT 500`,
    studentId,
    likeTenant,
  );

  const byKey = new Map<
    string,
    { eventId: number; assessment_day: Date; last_ts: Date }
  >();

  for (const r of rows) {
    const parsed = parseEncodedAssessmentLevel(r.level);
    if (!parsed || parsed.tenantId !== tenantId) continue;
    const dk = new Date(r.date);
    dk.setHours(0, 0, 0, 0);
    const dayStr = dk.toISOString().slice(0, 10);
    const key = `${parsed.eventId}|${dayStr}`;
    const prev = byKey.get(key);
    if (!prev || r.date > prev.last_ts) {
      byKey.set(key, {
        eventId: parsed.eventId,
        assessment_day: dk,
        last_ts: r.date,
      });
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.last_ts.getTime() - a.last_ts.getTime())
    .slice(0, limit)
    .map((v) => ({
      event_id: v.eventId,
      assessment_day: v.assessment_day,
      last_ts: v.last_ts,
    }));
}

export async function fetchFitnessResultsStudentEventDay(
  prisma: PrismaClient,
  studentId: bigint,
  eventId: number,
  tenantId: number,
  dayStart: Date,
  dayEnd: Date,
): Promise<FitnessResultJoinedRow[]> {
  const prefix = assessmentLevelLikePrefix(eventId, tenantId);
  return prisma.$queryRawUnsafe<FitnessResultJoinedRow[]>(
    `${SELECT_JOINED}
   WHERE fr.gymnast_id = ?
     AND fr.level LIKE ?
     AND fr.date >= ?
     AND fr.date < ?
   ORDER BY COALESCE(fc.name, '') ASC, fs.name ASC`,
    studentId,
    `${prefix}%`,
    dayStart,
    dayEnd,
  );
}

/** Insert one row — only columns that exist on a typical fitness_result table */
export async function insertFitnessResultRow(
  db: DbExec,
  row: {
    gymnastId: bigint;
    categoryName: string;
    fitnessSkillId: number;
    fitnessCategoryId: number;
    achievedValue: string;
    remarks: string | null;
    date: Date;
    eventId: number;
    tenantId: number;
  },
): Promise<void> {
  const level = encodeAssessmentLevel(row.eventId, row.tenantId, row.categoryName);
  await db.$executeRawUnsafe(
    `INSERT INTO fitness_result (
       gymnast_id, level, fitness_skill_id, fitness_categoryid,
       achieved_value, remarks, date
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    row.gymnastId,
    level,
    row.fitnessSkillId,
    row.fitnessCategoryId,
    row.achievedValue,
    row.remarks,
    row.date,
  );
}
