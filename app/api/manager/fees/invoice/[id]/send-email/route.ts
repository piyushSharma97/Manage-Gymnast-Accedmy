import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import {
  getParentEmailForStudent,
  sendInvoiceGeneratedEmail,
} from '@/services/invoice-email';

/**
 * POST: Send invoice email to parent/guardian.
 * Uses academy SMTP if configured, else owner SMTP.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const tenantContext = await getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!tenantContext.isManager) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const id = BigInt(idParam);
    if (id <= 0) {
      return NextResponse.json(
        { message: 'Invalid invoice ID' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId!,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNo: true,
          },
        },
        tenant: {
          select: { academyName: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { message: 'Invoice not found' },
        { status: 404 }
      );
    }

    const parentEmail = await getParentEmailForStudent(
      prisma,
      invoice.studentId,
      invoice.tenantId
    );

    if (!parentEmail) {
      return NextResponse.json(
        { message: 'No parent/guardian email found for this student' },
        { status: 400 }
      );
    }

    const studentName =
      [invoice.student.firstName, invoice.student.lastName]
        .filter(Boolean)
        .join(' ') || invoice.student.registrationNo;

    await sendInvoiceGeneratedEmail({
      to: parentEmail,
      tenantId: invoice.tenantId,
      academyName: invoice.tenant.academyName,
      studentName,
      invoiceNo: invoice.invoiceno,
      amount: invoice.amount != null ? Number(invoice.amount) : null,
      dueDate: invoice.dueDate,
      billingMonth: invoice.billingMonth,
    });

    return NextResponse.json({
      message: 'Invoice email sent successfully',
      to: parentEmail,
    });
  } catch (error: unknown) {
    console.error('Send invoice email error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to send email';
    return NextResponse.json({ message }, { status: 500 });
  }
}
