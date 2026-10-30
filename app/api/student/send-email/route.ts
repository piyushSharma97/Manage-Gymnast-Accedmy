import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { sendEmail } from '@/services/send-email';
import { getErrorMessage } from '@/types/api';

/**
 * POST: Send a generic academy email to selected students' parent (primary guardian or student email).
 * Body: { studentIds: string[]; subject?: string; description?: string }
 * Each parent receives only their child's context. Parent emails are not exposed.
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
    const customSubject = typeof body?.subject === 'string' ? body.subject.trim() : null;
    const customDescription = typeof body?.description === 'string' ? body.description.trim() : null;
    const studentIds = rawIds
      .map((id: unknown) => (typeof id === 'string' ? id.trim() : String(id)))
      .filter(Boolean);
    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'At least one student must be selected' }, { status: 400 });
    }

    const idsBigInt = studentIds
      .map((id: string) => BigInt(id))
      .filter((id: bigint) => id > BigInt(0));
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
        email: true,
        studentguardians: {
          where: { isPrimary: true },
          take: 1,
          select: {
            guardian: {
              select: { email: true, firstName: true },
            },
          },
        },
      },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId },
      select: { academyName: true },
    });

    const defaultSubject = `Message from ${tenant?.academyName || 'My Academy'}`;
    const defaultDescription =
      'This is a message from your academy. Please log in to your account or contact the academy for more details.';

    const results: { studentId: string; email: string | null; sent: boolean; error?: string }[] = [];
    for (const student of students) {
      // Use parent (primary guardian) email first, then student email
      const guardianEmail = student.studentguardians?.[0]?.guardian?.email ?? null;
      const toEmail = guardianEmail || student.email;
      if (!toEmail || !toEmail.includes('@')) {
        results.push({ studentId: String(student.id), email: toEmail || null, sent: false, error: 'No parent email' });
        continue;
      }
      const subject = customSubject || defaultSubject;
      const description = customDescription || defaultDescription;
      const guardianName = student.studentguardians?.[0]?.guardian?.firstName;
      const greeting = guardianName ? `Hello, ${guardianName}` : 'Hello';
      try {
        await sendEmail({
          to: toEmail,
          tenantId: tenantContext.tenantId,
          subject,
          content: {
            title: greeting,
            subtitle: 'You have a message from your academy.',
            description,
          },
        });
        results.push({ studentId: String(student.id), email: toEmail, sent: true });
      } catch (err) {
        results.push({
          studentId: String(student.id),
          email: toEmail,
          sent: false,
          error: getErrorMessage(err),
        });
      }
    }

    const sentCount = results.filter((r) => r.sent).length;
    return NextResponse.json({
      message: `Email sent to ${sentCount} of ${students.length} selected.`,
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
