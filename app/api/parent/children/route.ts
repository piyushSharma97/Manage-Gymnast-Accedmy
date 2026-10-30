import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { prisma } from '@/lib/prisma';

const jsonBigInt = (obj: unknown) =>
  JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

/**
 * GET /api/parent/children
 * Returns list of children (students) linked to the current parent/guardian user.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request);
    if (!context) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }
    if (!context.isParent) {
      return NextResponse.json(
        { message: 'Parent or guardian access required' },
        { status: 403 },
      );
    }

    const guardian = await prisma.guardian.findFirst({
      where: { userId: context.user.id },
      include: {
        studentguardians: {
          where: {
            student: {
              status: 'ACTIVE',
              deletedAt: null,
            },
          },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                registrationNo: true,
                skilllevelName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      return NextResponse.json({ data: [] });
    }

    const children = guardian.studentguardians.map((sg) => ({
      id: sg.student.id.toString(),
      firstName: sg.student.firstName,
      lastName: sg.student.lastName,
      name: `${sg.student.firstName} ${sg.student.lastName || ''}`.trim(),
      registrationNo: sg.student.registrationNo,
      level: sg.student.skilllevelName,
      profilePhotoUrl: sg.student.profilePhotoUrl,
    }));

    return NextResponse.json({ data: jsonBigInt(children) });
  } catch (error) {
    console.error('[parent/children]', error);
    return NextResponse.json(
      { message: 'Failed to fetch children' },
      { status: 500 },
    );
  }
}
