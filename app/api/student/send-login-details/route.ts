import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { sendEmail } from '@/services/send-email';
import { getErrorMessage } from '@/types/api';

/**
 * POST: Send login / password-setup email to selected students' parents (primary guardian).
 * Body: { studentIds: string[] }
 * Sends a password reset/setup link to the parent's (Guardian's User) email.
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const rawIds = Array.isArray(body?.studentIds) ? body.studentIds : [];
    const studentIds = rawIds
      .map((id: unknown) => (typeof id === 'string' ? id.trim() : String(id)))
      .filter(Boolean);
    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'At least one student must be selected' }, { status: 400 });
    }

    const idsBigInt = studentIds.map((id: string) => BigInt(id)).filter((id: bigint) => id > 0);
    const students = await prisma.student.findMany({
      where: {
        id: { in: idsBigInt },
        tenantId: tenantContext.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        studentguardians: {
          where: { isPrimary: true },
          take: 1,
          select: {
            guardian: {
              select: { userId: true, email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Collect User IDs: primary Guardian's userId or student.userId
    const userIdsToFetch = new Set<string>();
    for (const student of students) {
      const guardianUserId = student.studentguardians?.[0]?.guardian?.userId;
      if (guardianUserId) userIdsToFetch.add(guardianUserId);
      else if (student.userId) userIdsToFetch.add(student.userId);
    }
    const users =
      userIdsToFetch.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: Array.from(userIdsToFetch) } },
            select: { id: true, email: true, name: true, lastName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId },
      select: { academyName: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    const results: { studentId: string; email: string | null; sent: boolean; error?: string }[] = [];

    for (const student of students) {
      // Parent: primary Guardian's User first, fallback to Student's User
      const guardian = student.studentguardians?.[0]?.guardian;
      const targetUserId = guardian?.userId || student.userId;
      const user = targetUserId ? userMap.get(targetUserId) : null;
      const toEmail = user?.email ?? null;

      if (!targetUserId || !user?.email || !user.email.includes('@')) {
        results.push({
          studentId: String(student.id),
          email: null,
          sent: false,
          error: guardian?.email
            ? 'Parent has no login account. Please create a user for this guardian.'
            : 'No parent or linked user with email',
        });
        continue;
      }

      const identifier = targetUserId;
      const passwordSetupToken = crypto.randomBytes(48).toString('hex');
      const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await prisma.verificationToken.deleteMany({
        where: { identifier },
      });
      await prisma.verificationToken.create({
        data: {
          identifier,
          token: passwordSetupToken,
          expires: passwordSetupExpiry,
        },
      });

      const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${passwordSetupToken}`;
      const greetingName =
        [user?.name, user?.lastName].filter(Boolean).join(' ') ||
        [guardian?.firstName, guardian?.lastName].filter(Boolean).join(' ') ||
        toEmail;

      const userEmail = user!.email as string;
      try {
        await sendEmail({
          to: userEmail,
          tenantId: tenantContext.tenantId,
          subject: `Your login details – ${tenant?.academyName || 'My Academy'}`,
          content: {
            title: `Hello, ${greetingName}`,
            subtitle: 'Your account login details',
            buttonLabel: 'Set password / Log in',
            buttonUrl: passwordSetupUrl,
            description:
              'Use the link above to set your password or log in. This link expires in 48 hours. If you did not request this, please contact your academy.',
          },
        });
        results.push({ studentId: String(student.id), email: userEmail, sent: true });
      } catch (err) {
        results.push({
          studentId: String(student.id),
          email: userEmail,
          sent: false,
          error: getErrorMessage(err),
        });
      }
    }

    const sentCount = results.filter((r) => r.sent).length;
    return NextResponse.json({
      message: `Login details sent to ${sentCount} of ${students.length} selected.`,
      results,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
