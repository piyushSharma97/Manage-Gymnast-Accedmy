import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
// import { NotificationSettingsSchema, NotificationSettingsSchemaType } from '@/app/(protected)/user-management/settings/forms/notification-settings-schema';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 }, // Unauthorized
      );
    }

    const clientIp = getClientIP(request);
    const settings = await prisma.systemSetting.findFirst();
    if (!settings) {
      return NextResponse.json(
        { message: 'Settings not found.' },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const notificationKeys = [
      'notifyStockEmail', 'notifyStockWeb', 'notifyStockThreshold',
      'notifyNewOrderEmail', 'notifyNewOrderWeb',
      'notifyOrderStatusUpdateEmail', 'notifyOrderStatusUpdateWeb',
      'notifyPaymentFailureEmail', 'notifyPaymentFailureWeb',
      'notifySystemErrorFailureEmail', 'notifySystemErrorWeb',
    ] as const;
    const updateData: Record<string, boolean | number> = {};
    for (const key of notificationKeys) {
      if (key in body) {
        const val = body[key];
        if (key === 'notifyStockThreshold') {
          if (typeof val === 'number' && val >= 0) updateData[key] = val;
          else if (typeof val === 'string' && /^\d+$/.test(val)) updateData[key] = parseInt(val, 10);
        } else if (typeof val === 'boolean') {
          updateData[key] = val;
        }
      }
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { message: 'No valid notification fields to update.' },
        { status: 400 },
      );
    }

    const updatedSettings = await prisma.systemSetting.update({
      where: { id: settings.id },
      data: updateData,
    });

    // Log the event
    await systemLog({
      event: 'update',
      userId: session.user.id,
      entityId: String(settings.id),
      entityType: 'system.settings',
      description: 'System notifications updated.',
      ipAddress: clientIp,
    });

    // Return success response
    return NextResponse.json(
      {
        message: 'Notification settings updated successfully',
        data: updatedSettings,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        message: 'An error occurred while updating the notification settings.',
      },
      { status: 500 },
    );
  }
}
