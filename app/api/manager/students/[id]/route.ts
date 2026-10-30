import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import { getTenantContext } from '@/lib/api/tenant-helpers';

const jsonBigInt = (data: any) =>
  JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// GET: Fetch a specific student by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: idParam } = await params;
    const idParts = idParam.split('-');
    console.log('Parsed ID Parts:', idParts,idParts[0],idParts[1]);
    const id = BigInt(idParts[0]);
   
   const locationId = BigInt(idParts[1]) || null;

    const student = await prisma.student.findFirst({
      where: { id, tenantId: tenantContext.tenantId },
      include: {
        location: { select: { id: true, centerName: true } },
        tenant: { select: { id: true, academyName: true } },
        studentguardians: {
          include: {
            guardian: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                address: true,
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(jsonBigInt(student));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// PUT: Update a specific student
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantContext = await getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }
    if (!tenantContext.isManager) {
      return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
    }

    const clientIp = getClientIP(request);
    const { id: idParam } = await params;
    const id = BigInt(idParam);
    const body = await request.json();

    const existing = await prisma.student.findFirst({ where: { id, tenantId: tenantContext.tenantId } });
    if (!existing) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const updateData: any = {};
    const assignIfPresent = (key: string, value: any) => {
      if (value !== undefined) updateData[key] = value;
    };

    assignIfPresent('firstName', typeof body?.firstName === 'string' ? body.firstName.trim() : undefined);
    assignIfPresent('lastName', typeof body?.lastName === 'string' ? body.lastName.trim() : undefined);
    assignIfPresent('email', typeof body?.email === 'string' ? body.email.trim() : undefined);
    assignIfPresent('phone', typeof body?.phone === 'string' ? body.phone.trim() : undefined);
    assignIfPresent('gender', typeof body?.gender === 'string' ? body.gender : undefined);
    assignIfPresent('status', typeof body?.status === 'string' ? body.status : undefined);
    assignIfPresent('locationId', typeof body?.locationId === 'number' ? body.locationId : undefined);
    // Handle team: convert empty string to null, otherwise trim
    assignIfPresent('team', typeof body?.team === 'string' ? (body.team.trim() || null) : undefined);
    // Handle skilllevelName: accept string input, convert empty string to null
    if (body?.skilllevelName !== undefined) {
      if (typeof body.skilllevelName === 'string') {
        const trimmed = body.skilllevelName.trim();
        assignIfPresent('skilllevelName', trimmed || null);
      } else {
        assignIfPresent('skilllevelName', body.skilllevelName ?? null);
      }
    } else if (body?.currentSkillLevelId !== undefined) {
      const legacyValue = typeof body.currentSkillLevelId === 'string' ? body.currentSkillLevelId.trim() : null;
      assignIfPresent('skilllevelName', legacyValue || null);
    }
    assignIfPresent('Board', typeof body?.Board === 'string' ? body.Board : undefined);
    assignIfPresent('schoolName', typeof body?.schoolName === 'string' ? body.schoolName.trim() : undefined);
    assignIfPresent('gradeClass', typeof body?.gradeClass === 'string' ? body.gradeClass.trim() : undefined);
    // Handle bloodGroup: convert empty string to null, otherwise trim
    assignIfPresent('bloodGroup', typeof body?.bloodGroup === 'string' ? (body.bloodGroup.trim() || null) : undefined);
    assignIfPresent('addressLine1', typeof body?.addressLine1 === 'string' ? body.addressLine1.trim() : undefined);
    assignIfPresent('addressLine2', typeof body?.addressLine2 === 'string' ? body.addressLine2.trim() : undefined);
    assignIfPresent('city', typeof body?.city === 'string' ? body.city.trim() : undefined);
    assignIfPresent('state', typeof body?.state === 'string' ? body.state.trim() : undefined);
    assignIfPresent('postalCode', typeof body?.postalCode === 'string' ? body.postalCode.trim() : undefined);
    assignIfPresent('profilePhotoUrl', typeof body?.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : undefined);
    assignIfPresent('joinDate', body?.joinDate ? new Date(body.joinDate) : undefined);
    assignIfPresent('notes', typeof body?.notes === 'string' ? body.notes : undefined);
    assignIfPresent('deactivateDate', body?.deactivateDate ? new Date(body.deactivateDate) : undefined);
    assignIfPresent('courseId', body?.courseId ?? undefined);
    assignIfPresent('lastfeesamt', body?.lastfeesamt ?? undefined);
    assignIfPresent('lastfeesdate', body?.lastfeesdate ? new Date(body.lastfeesdate) : undefined);
    assignIfPresent('nextduedate', body?.nextduedate ? new Date(body.nextduedate) : undefined);
    assignIfPresent('dob', body?.dob ? new Date(body.dob) : undefined);
    updateData.updatedBy = tenantContext.user.id;

    const updated = await prisma.student.update({
      where: { id },
      data: updateData,
    });

    await systemLog({
      event: 'update',
      userId: tenantContext.user.id,
      entityId: Number(updated.id).toString(),
      entityType: 'student',
      description: 'Student updated.',
      ipAddress: clientIp,
    });

    return NextResponse.json(jsonBigInt(updated));
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific student
// export async function DELETE(
//   request: NextRequest,
//   { params }: { params: Promise<{ id: string }> }
// ) {
//   try {
//     const tenantContext = await getTenantContext(request);
//     if (!tenantContext) {
//       return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
//     }
//     if (!tenantContext.isOwner && !tenantContext.isAdmin) {
//       return NextResponse.json({ message: 'Insufficient permissions' }, { status: 403 });
//     }

//     const clientIp = getClientIP(request);
//     const { id: idParam } = await params;
//     const id = BigInt(idParam);

//     const existing = await prisma.student.findFirst({ where: { id, tenantId: tenantContext.tenantId } });
//     if (!existing) {
//       return NextResponse.json({ message: 'Student not found' }, { status: 404 });
//     }

//     await prisma.student.delete({ where: { id } });

//     await systemLog({
//       event: 'delete',
//       userId: tenantContext.user.id,
//       entityId: Number(id).toString(),
//       entityType: 'student',
//       description: 'Student deleted.',
//       ipAddress: clientIp,
//     });

//     return NextResponse.json({ success: true });
//   } catch (error: any) {
//     console.error('API Error:', error);
//     return NextResponse.json(
//       { message: error?.message || 'Unexpected error' },
//       { status: 500 },
//     );
//   }
// }


