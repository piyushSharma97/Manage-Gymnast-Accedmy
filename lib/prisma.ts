import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : [],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
}

 /** Delegate shape for extended Prisma models (used when generated client types are stale) */
type PrismaDelegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  findFirst: (args?: unknown) => Promise<unknown | null>;
  create: (args: unknown) => Promise<unknown>;
  createMany: (args?: unknown) => Promise<{ count: number }>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<{ count: number }>;
  count: (args?: unknown) => Promise<number>;
};

/**
 * Prisma client type including FitnessSkill, FitnessCategory, FitnessGradingCriteria,
 * ParentYoutubeLink, and EmployeeSkillLevel delegates.
 * Use this so TypeScript accepts these models when generated client types are stale.
 * Run: npx prisma generate
 */
export type PrismaClientWithFitnessSkill = PrismaClient & {
  fitnessSkill: PrismaDelegate;
  fitnessCategory: PrismaDelegate;
  fitnessGradingCriteria: PrismaDelegate;
  parentYoutubeLink: PrismaDelegate;
  employeeSkillLevel: PrismaDelegate;
};

export const prisma = prismaClient as PrismaClientWithFitnessSkill;
export default prisma;
