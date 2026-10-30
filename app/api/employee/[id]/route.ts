import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import { getErrorMessage } from '@/types/api';

// GET: Fetch a specific employee by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request as NextRequest);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to view employees
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid employee ID' },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
      },
      include: {
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
        employeeSkillLevels: {
          include: {
            skillLevel: {
              select: { id: true, levelName: true, levelCode: true },
            },
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 },
      );
    }

    // Get roleId from user if employee has a userId
    let roleId: number | null = null;
    if (employee.userId) {
      const user = await prisma.user.findUnique({
        where: { id: employee.userId },
        select: { roleId: true },
      });
      if (user?.roleId) {
        roleId = user.roleId;
      }
    }

    // Map role enum to roleId if user doesn't exist or doesn't have roleId
    if (!roleId) {
      const enumToRoleIdMap: { [key: string]: number } = {
        'Admin': 2,
        'Manager': 3,
        'Staff': 4,
        'Coach': 5,
      };
      roleId = enumToRoleIdMap[employee.role] || 4;
    }

    return NextResponse.json({ ...employee, roleId });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// PUT: Update a specific employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to update employees
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid employee ID' },
        { status: 400 },
      );
    }

    // Check if employee exists and belongs to tenant
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 },
      );
    }

    const locationId = typeof body?.locationId === 'number' ? body.locationId : existingEmployee.locationId;
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : existingEmployee.firstName;
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : existingEmployee.lastName;
    const email = typeof body?.email === 'string' ? body.email.trim() : existingEmployee.email;
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : existingEmployee.phone;
    const requestRoleId = typeof body?.roleId === 'number' ? body.roleId : null;
    const hiredDate = typeof body?.hiredDate === 'string' ? new Date(body.hiredDate) : existingEmployee.hiredDate;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : existingEmployee.isActive;
    const profilePhotoUrl = typeof body?.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : existingEmployee.profilePhotoUrl || null;
    const emergencyContactName = typeof body?.emergencyContactName === 'string' ? body.emergencyContactName.trim() : existingEmployee.emergencyContactName || null;
    const emergencyContactPhone = typeof body?.emergencyContactPhone === 'string' ? body.emergencyContactPhone.trim() : existingEmployee.emergencyContactPhone || null;
    const skillLevelIds = Array.isArray(body?.skillLevelIds)
      ? body.skillLevelIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0)
      : null;

    if (!firstName || firstName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid firstName' },
        { status: 400 },
      );
    }

    if (lastName && lastName.length > 100) {
      return NextResponse.json(
        { message: 'Invalid lastName' },
        { status: 400 },
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 },
      );
    }

    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 },
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { message: 'Phone is required' },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { message: 'Phone must be exactly 10 digits' },
        { status: 400 },
      );
    }
    if (emergencyContactPhone && !/^\d{10}$/.test(emergencyContactPhone)) {
      return NextResponse.json(
        { message: 'Emergency contact phone must be exactly 10 digits' },
        { status: 400 },
      );
    }

    // If requestRoleId is provided, validate and map it. Otherwise use existing employee's role.
    let role: 'Admin' | 'Staff' | 'Coach'|'Manager' = existingEmployee.role;
    
    if (requestRoleId !== null) {
      const validRoleIds = [2, 3, 4, 5]; // Admin: 2, Manager: 3, Staff: 4, Coach: 5
      if (!validRoleIds.includes(requestRoleId)) {
        return NextResponse.json(
          { message: 'Invalid roleId. Must be 2 (Admin), 3 (Manager), 4 (Staff), or 5 (Coach)' },
          { status: 400 },
        );
      }

      // Map roleId to EmployeeRole enum (Admin and Manager are distinct)
      const roleIdToEnumMap: { [key: number]: 'Admin' | 'Manager' | 'Staff' | 'Coach' } = {
        2: 'Admin',
        3: 'Manager',
        4: 'Staff',
        5: 'Coach',
      };

      role = roleIdToEnumMap[requestRoleId];
    }
    
    // For roleId mapping to user.roleId, use the provided roleId or map from existing role
    let mappedRoleId: number;
    if (requestRoleId !== null) {
      mappedRoleId = requestRoleId;
    } else {
      // Map existing role enum to roleId (default Admin to 2)
      // Try to get roleId from user if employee has a userId
      if (existingEmployee.userId) {
        const user = await prisma.user.findUnique({
          where: { id: existingEmployee.userId },
          select: { roleId: true },
        });
        if (user?.roleId) {
          mappedRoleId = user.roleId;
        } else {
          const enumToRoleIdMap: { [key: string]: number } = {
            'Admin': 2,
            'Manager': 3,
            'Staff': 4,
            'Coach': 5,
          };
          mappedRoleId = enumToRoleIdMap[existingEmployee.role] || 4;
        }
      } else {
        const enumToRoleIdMap: { [key: string]: number } = {
          'Admin': 2,
          'Manager': 3,
          'Staff': 4,
          'Coach': 5,
        };
        mappedRoleId = enumToRoleIdMap[existingEmployee.role] || 4;
      }
    }

    // Check if location exists and belongs to tenant
    const location = await prisma.location.findFirst({
      where: {
        id: locationId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!location) {
      return NextResponse.json(
        { message: 'Location not found or access denied' },
        { status: 404 },
      );
    }

    // Check if email is unique within tenant (excluding current employee)
    if (email && email !== existingEmployee.email) {
      const existingEmployeeWithEmail = await prisma.employee.findFirst({
        where: {
          email: email,
          tenantId: tenantContext.tenantId,
          id: { not: id },
        },
      });
      if (existingEmployeeWithEmail) {
        return NextResponse.json(
          { message: 'Email already exists' },
          { status: 400 },
        );
      }
    }

    // Use mappedRoleId (already calculated above)
    const roleId = mappedRoleId;

    // Update or create user if email is provided
    let updatedUser = null;
    if (email && existingEmployee.userId) {
      // Update existing user
      updatedUser = await prisma.user.update({
        where: { id: existingEmployee.userId },
        data: {
          locationId: locationId,
          roleId: roleId,
          name: firstName,
          lastName: lastName,
          email: email,
          updatedBy: tenantContext.user?.id || '',
        },
      });
    } else if (email && !existingEmployee.userId) {
      // Create new user
      const tempPassword = Math.random().toString(36).slice(-8);
      updatedUser = await prisma.user.create({
        data: {
          tenantId: tenantContext.tenantId,
          locationId: locationId,
          roleId: roleId,
          name: firstName,
          lastName: lastName,
          email: email,
          password: tempPassword,
          status: 'ACTIVE',
          createdBy: tenantContext.user?.id || '',
        },
      });
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        locationId: locationId,
        userId: updatedUser?.id || existingEmployee.userId,
        firstName: firstName,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        role: role,
        hiredDate: hiredDate || null,
        isActive: isActive,
        profilePhotoUrl: profilePhotoUrl || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        updatedBy: tenantContext.user?.id || '',
      },
      include: {
        location: {
          select: {
            id: true,
            centerName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            academyName: true,
          },
        },
        employeeSkillLevels: {
          include: {
            skillLevel: {
              select: { id: true, levelName: true, levelCode: true },
            },
          },
        },
      },
    });

    // For coaches: update employee-skill-level mappings
    if (role === 'Coach' && skillLevelIds !== null) {
      const validSkillLevels = await prisma.skillLevel.findMany({
        where: {
          id: { in: skillLevelIds },
          tenantId: tenantContext.tenantId!,
          isActive: true,
        },
        select: { id: true },
      });
      const validIds = validSkillLevels.map((sl) => sl.id);
      await prisma.employeeSkillLevel.deleteMany({ where: { employeeId: id } });
      if (validIds.length > 0) {
        await prisma.employeeSkillLevel.createMany({
          data: validIds.map((skillLevelId) => ({
            employeeId: id,
            skillLevelId,
            createdBy: tenantContext.user?.id || '',
          })),
          skipDuplicates: true,
        });
      }
    } else if (role !== 'Coach') {
      await prisma.employeeSkillLevel.deleteMany({ where: { employeeId: id } });
    }

    // Re-fetch so `employeeSkillLevels` matches junction rows (update() ran before sync above)
    const refreshed = await prisma.employee.findFirst({
      where: { id, tenantId: tenantContext.tenantId! },
      include: {
        location: { select: { id: true, centerName: true } },
        tenant: { select: { id: true, academyName: true } },
        employeeSkillLevels: {
          include: {
            skillLevel: {
              select: { id: true, levelName: true, levelCode: true },
            },
          },
        },
      },
    });
    const employeeForResponse = refreshed ?? updatedEmployee;

    let responseRoleId: number | null = null;
    if (employeeForResponse.userId) {
      const u = await prisma.user.findUnique({
        where: { id: employeeForResponse.userId },
        select: { roleId: true },
      });
      if (u?.roleId) responseRoleId = u.roleId;
    }
    if (!responseRoleId) {
      const enumToRoleIdMap: { [key: string]: number } = {
        Admin: 2,
        Manager: 3,
        Staff: 4,
        Coach: 5,
      };
      responseRoleId = enumToRoleIdMap[employeeForResponse.role] || 4;
    }

    // Log the action
    await systemLog({
      event: 'UPDATE_EMPLOYEE',
      userId: tenantContext.user?.id || '',
      entityId: employeeForResponse.id,
      entityType: 'EMPLOYEE',
      description: `Updated employee: ${firstName} ${lastName || ''}`.trim(),
      ipAddress: clientIp,
      meta: JSON.stringify({
        employeeName: `${firstName} ${lastName || ''}`.trim(),
        role: role,
        locationId: locationId,
        userId: updatedUser?.id || existingEmployee.userId,
      }),
    });

    return NextResponse.json({ ...employeeForResponse, roleId: responseRoleId });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// DELETE: Delete a specific employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to delete employees
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const id = parseInt(idParam);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { message: 'Invalid employee ID' },
        { status: 400 },
      );
    }

    // Check if employee exists and belongs to tenant
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        id,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { message: 'Employee not found' },
        { status: 404 },
      );
    }

    // Check if employee is associated with any batches
    const batchCount = await prisma.batch.count({
      where: {
        coachId: id,
      },
    });

    if (batchCount > 0) {
      return NextResponse.json(
        { message: 'Cannot delete employee. Employee is associated with batches.' },
        { status: 400 },
      );
    }

    // Delete associated user if exists
    if (existingEmployee.userId) {
      await prisma.user.delete({
        where: { id: existingEmployee.userId },
      });
    }

    // Delete employee
    await prisma.employee.delete({
      where: { id },
    });

    // Log the action
    await systemLog({
      event: 'DELETE_EMPLOYEE',
      userId: tenantContext.user?.id || '',
      entityId: id,
      entityType: 'EMPLOYEE',
      description: `Deleted employee: ${existingEmployee.firstName} ${existingEmployee.lastName || ''}`.trim(),
      ipAddress: clientIp,
      meta: JSON.stringify({
        employeeName: `${existingEmployee.firstName} ${existingEmployee.lastName || ''}`.trim(),
        role: existingEmployee.role,
        locationId: existingEmployee.locationId,
      }),
    });

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
