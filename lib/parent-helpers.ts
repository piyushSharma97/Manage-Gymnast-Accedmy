import { prisma } from '@/lib/prisma';

/**
 * Verify that the current user (parent/guardian) is linked to the given student.
 */
export async function ensureParentOfStudent(
  userId: string,
  studentIdBigInt: bigint,
): Promise<boolean> {
  const link = await prisma.studentGuardian.findFirst({
    where: {
      guardian: { userId },
      studentId: studentIdBigInt,
    },
  });
  return !!link;
}

export const jsonBigInt = (obj: unknown) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
