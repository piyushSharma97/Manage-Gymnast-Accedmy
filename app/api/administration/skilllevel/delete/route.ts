import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';

// DELETE: Bulk delete skill levels
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized request' },
        { status: 401 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const skillLevelIds = Array.isArray(body?.ids) ? body.ids : [];
    
    if (skillLevelIds.length === 0) {
      return NextResponse.json(
        { message: 'No skill level IDs provided' },
        { status: 400 },
      );
    }

    // Validate that all IDs are numbers
    const validIds = skillLevelIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0);
    
    if (validIds.length !== skillLevelIds.length) {
      return NextResponse.json(
        { message: 'Invalid skill level IDs provided' },
        { status: 400 },
      );
    }

    // Fetch skill level names for usage checks
    const skillLevelsToDelete = await prisma.skillLevel.findMany({
      where: { id: { in: validIds } },
      select: { id: true, levelName: true, levelCode: true },
    });

    const levelNames = skillLevelsToDelete.map((level) => level.levelName);

    // Check if any skill levels are being used by students (by name)
    const studentsCount = levelNames.length
      ? await prisma.student.count({
          where: {
            skilllevelName: { in: levelNames },
          },
        })
      : 0;

    if (studentsCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete skill levels that are assigned to students' },
        { status: 400 },
      );
    }

    // Delete the skill levels
    const deleteResult = await prisma.skillLevel.deleteMany({
      where: { id: { in: validIds } },
    });

    // Log the deletion
    for (const skillLevel of skillLevelsToDelete) {
      await systemLog({
        event: 'delete',
        userId: session.user.id,
        entityId: String(skillLevel.id),
        entityType: 'skill.level',
        description: `Skill level deleted: ${skillLevel.levelName} (${skillLevel.levelCode})`,
        ipAddress: clientIp,
      });
    }

    return NextResponse.json({
      message: `${deleteResult.count} skill level(s) deleted successfully`,
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
