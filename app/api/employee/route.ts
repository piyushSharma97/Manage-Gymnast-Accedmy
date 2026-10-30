import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getClientIP } from '@/lib/api';
import { isUnique } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { systemLog } from '@/services/system-log';
import authOptions from '@/app/api/auth/[...nextauth]/auth-options';
import { getTenantContext } from '@/lib/api/tenant-helpers';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendEmail } from '@/services/send-email';
import { getErrorMessage } from '@/types/api';
import type { Prisma } from '@prisma/client';
import type { EmployeeRole } from '@prisma/client';

// GET: Fetch all employees
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || 1);
  const limit = Number(searchParams.get('limit') || 10);
  const query = searchParams.get('query') || '';
  const sortField = searchParams.get('sort') || 'createdAt';
  const sortDirection = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const isActive = searchParams.get('active');
  const locationId = searchParams.get('locationId');
  const role = searchParams.get('role');
  const skip = (page - 1) * limit;

  try {
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

    const andConditions: Prisma.EmployeeWhereInput[] = [
      {
        tenantId: tenantContext.tenantId,
      },
      {
        OR: [
          {
            firstName: {
              contains: query,
            },
          },
          {
            lastName: {
              contains: query,
            },
          },
          {
            email: {
              contains: query,
            },
          },
        ],
      },
    ];

    if (isActive === 'true' || isActive === 'false') {
      andConditions.push({ isActive: isActive === 'true' });
    }

    if (locationId) {
      andConditions.push({ locationId: parseInt(locationId) });
    }

    if (role) {
      andConditions.push({ role: role as EmployeeRole });
    }

    const whereClause: Prisma.EmployeeWhereInput = { AND: andConditions };

    // Count total records matching the filter
    const total = await prisma.employee.count({ where: whereClause });

    let isTableEmpty = false;
    if (total === 0) {
      const overallTotal = await prisma.employee.count({
        where: { tenantId: tenantContext.tenantId },
      });
      isTableEmpty = overallTotal === 0;
    }

    const employees =
      total > 0
        ? await prisma.employee.findMany({
            where: whereClause,
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
            } as Prisma.EmployeeInclude,
            orderBy: { [sortField]: sortDirection },
            skip,
            take: limit,
          })
        : [];

    // Add roleId to each employee by fetching from user table if userId exists
    const employeesWithRoleId = await Promise.all(
      employees.map(async (employee) => {
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
        return { ...employee, roleId };
      })
    );

    return NextResponse.json({
      data: employeesWithRoleId,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        isTableEmpty,
      },
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// POST: Add a new employee
export async function POST(request: NextRequest) {
  try {
    // Get tenant context
    const tenantContext = await getTenantContext(request);
    
    if (!tenantContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 },
      );
    }

    // Check if user has permission to create employees
    if (!tenantContext.isOwner && !tenantContext.isAdmin) {
      return NextResponse.json(
        { message: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const clientIp = getClientIP(request);
    const body = await request.json();

    const locationId = typeof body?.locationId === 'number' ? body.locationId : null;
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const roleId = typeof body?.roleId === 'number' ? body.roleId : null;
    const hiredDate = typeof body?.hiredDate === 'string' ? new Date(body.hiredDate) : null;
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
    const profilePhotoUrl = typeof body?.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : '';
    const emergencyContactName = typeof body?.emergencyContactName === 'string' ? body.emergencyContactName.trim() : '';
    const emergencyContactPhone = typeof body?.emergencyContactPhone === 'string' ? body.emergencyContactPhone.trim() : '';

    if (!locationId || locationId <= 0) {
      return NextResponse.json(
        { message: 'Invalid locationId' },
        { status: 400 },
      );
    }

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

    // Validate roleId
    const validRoleIds = [2, 3, 4, 5]; // Admin: 2, Manager: 3, Staff: 4, Coach: 5
    if (!roleId || !validRoleIds.includes(roleId)) {
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

    const role = roleIdToEnumMap[roleId];

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

    // Check if email is unique within tenant
    if (email) {
      const existingEmployee = await prisma.employee.findFirst({
        where: {
          email: email,
          tenantId: tenantContext.tenantId,
        },
      });
      if (existingEmployee) {
        return NextResponse.json(
          { message: 'Email already exists' },
          { status: 400 },
        );
      }

      // Also check if email exists in user table
      const existingUser = await prisma.user.findUnique({
        where: {
          email: email,
        },
      });
      if (existingUser) {
        return NextResponse.json(
          { message: 'Email already exists in user accounts' },
          { status: 400 },
        );
      }
    }

    // roleId is already set from request body

    // Create user first
    let createdUser = null;
    let passwordSetupToken: string | null = null;
    if (email) {
      // Don't set password - user must generate password to login
      // Generate password setup token for welcome email
      passwordSetupToken = crypto.randomBytes(48).toString('hex');
      const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      
      createdUser = await prisma.user.create({
        data: {
          tenantId: tenantContext.tenantId,
          locationId: locationId,
          roleId: roleId,
          name: firstName,
          lastName: lastName,
          email: email,
          password: null, // User must generate password
          status: 'ACTIVE',
          createdBy: tenantContext.user?.id || '',
        },
      });

      // Store password setup token
      await prisma.verificationToken.create({
        data: {
          identifier: createdUser.id,
          token: passwordSetupToken,
          expires: passwordSetupExpiry,
        },
      });

    }

    // Create employee
    const createdByUserId = tenantContext.user?.id || '';

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenantContext.tenantId!,
        locationId: locationId,
        userId: createdUser?.id || null,
        firstName: firstName,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        role: role as EmployeeRole,
        hiredDate: hiredDate || null,
        isActive: isActive,
        profilePhotoUrl: profilePhotoUrl || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        createdBy: createdByUserId,
      },
    });

    // For coaches: create employee-skill-level mappings
    const skillLevelIds = Array.isArray(body?.skillLevelIds)
      ? body.skillLevelIds.filter((id: unknown): id is number => typeof id === 'number' && id > 0)
      : [];
    if (role === 'Coach' && skillLevelIds.length > 0) {
      const validSkillLevels = await prisma.skillLevel.findMany({
        where: {
          id: { in: skillLevelIds },
          tenantId: tenantContext.tenantId!,
          isActive: true,
        },
        select: { id: true },
      });
      const validIds = validSkillLevels.map((sl) => sl.id);
      if (validIds.length > 0) {
        await prisma.employeeSkillLevel.createMany({
          data: validIds.map((skillLevelId) => ({
            employeeId: employee.id,
            skillLevelId,
            createdBy: createdByUserId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Log the action
    await systemLog({
      event: 'CREATE_EMPLOYEE',
      userId: tenantContext.user?.id || '',
      entityId: employee.id,
      entityType: 'EMPLOYEE',
      description: `Created employee: ${firstName} ${lastName || ''}`.trim(),
      ipAddress: clientIp,
      meta: JSON.stringify({
        employeeName: `${firstName} ${lastName || ''}`.trim(),
        role: role,
        locationId: locationId,
        userId: createdUser?.id || null,
      }),
    });

    // Send welcome email if user was created (don't fail employee creation if email fails)
    if (createdUser && email && passwordSetupToken) {
      try {
        // Get base URL for password setup link
        const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${passwordSetupToken}`;

        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantContext.tenantId },
          select: { academyName: true },
        });

        await sendEmail({
          to: email,
          tenantId: tenantContext.tenantId,
          subject: `Welcome to ${tenant?.academyName || 'My Academy'}!`,
          content: {
            title: `Hello, ${firstName}${lastName ? ` ${lastName}` : ''}`,
            subtitle: 'Your account has been created. Please set your password using the link below to log in.',
            buttonLabel: 'Set Password',
            buttonUrl: passwordSetupUrl,
            description: `Welcome to the team! Your account has been created. Click the button above to set your password and complete your account setup. The password setup link expires in 48 hours.`,
          },
        });
        console.log(`Welcome email sent successfully to ${email} for employee ${employee.id}`);
      } catch (emailError: unknown) {
        // Log error but don't fail employee creation
        console.error(`Failed to send welcome email to ${email}:`, emailError);
        console.error('Employee created successfully but email notification failed:', {
          employeeId: employee.id,
          email: email,
          error: getErrorMessage(emailError),
        });
      }
    }

    const employeeWithSkillLevels = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        location: { select: { id: true, centerName: true } },
        tenant: { select: { id: true, academyName: true } },
        employeeSkillLevels: {
          include: {
            skillLevel: { select: { id: true, levelName: true, levelCode: true } },
          },
        },
      } as Prisma.EmployeeInclude,
    });
    return NextResponse.json(employeeWithSkillLevels ?? employee, { status: 201 });
  } catch (error: unknown) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
