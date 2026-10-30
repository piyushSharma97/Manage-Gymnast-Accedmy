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

    const whereClause: any = {
      AND: [
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
      ],
    };

    if (isActive === 'true' || isActive === 'false') {
      whereClause.AND.push({ isActive: isActive === 'true' });
    }

    if (locationId) {
      whereClause.AND.push({ locationId: parseInt(locationId) });
    }

    if (role) {
      whereClause.AND.push({ role: role });
    }

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
            },
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
      employees: employeesWithRoleId,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        isTableEmpty,
      },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
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

    if (email && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 },
      );
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { message: 'Phone must be exactly 10 digits' },
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

    // Map roleId to EmployeeRole enum
    // Note: Both Admin (2) and Manager (3) map to 'Admin' enum since database only has Admin, Staff, Coach
    const roleIdToEnumMap: { [key: number]: 'Admin' | 'Staff' | 'Coach' } = {
      2: 'Admin',  // Admin
      3: 'Admin',  // Manager maps to Admin enum
      4: 'Staff',  // Staff
      5: 'Coach',  // Coach
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
    }

    // roleId is already set from request body

    // Create user first
    let createdUser = null;
    let passwordSetupToken: string | null = null;
    let tempPassword: string | null = null;
    if (email) {
      // Generate a temporary password
      tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      // Hash the temporary password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      createdUser = await prisma.user.create({
        data: {
          tenantId: tenantContext.tenantId,
          locationId: locationId,
          roleId: roleId,
          name: firstName,
          lastName: lastName,
          email: email,
          password: hashedPassword,
          status: 'ACTIVE',
          createdBy: tenantContext.user?.id || '',
        },
      });

      // Generate password setup token
      passwordSetupToken = crypto.randomBytes(48).toString('hex');
      const passwordSetupExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      await prisma.verificationToken.create({
        data: {
          identifier: createdUser.id,
          token: passwordSetupToken,
          expires: passwordSetupExpiry,
        },
      });

    }

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        tenantId: tenantContext.tenantId!,
        locationId: locationId,
        userId: createdUser?.id || null,
        firstName: firstName,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        role: role as any,
        hiredDate: hiredDate || null,
        isActive: isActive,
        createdBy: tenantContext.user?.id || '',
      },
    });

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

    // Send password setup email if user was created (don't fail employee creation if email fails)
    if (createdUser && email && passwordSetupToken && tempPassword) {
      try {
        // Get base URL for password setup link
        const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const passwordSetupUrl = `${normalizedBaseUrl}/change-password?token=${passwordSetupToken}`;

        await sendEmail({
          to: email,
          tenantId: tenantContext.tenantId,
          subject: 'Welcome! Your Account Credentials',
          content: {
            title: `Hello, ${firstName}${lastName ? ` ${lastName}` : ''}`,
            subtitle: 'Your account has been created. Use the temporary password below to log in, or set a new password using the link.',
            buttonLabel: 'Set New Password',
            buttonUrl: passwordSetupUrl,
            description: `Your temporary password is: ${tempPassword}\n\nYou can use this password to log in, or click the button above to set a new password. The password setup link expires in 48 hours.`,
          },
        });
        console.log(`Password setup email sent successfully to ${email} for employee ${employee.id}`);
      } catch (emailError: any) {
        // Log error but don't fail employee creation
        console.error(`Failed to send password setup email to ${email}:`, emailError);
        console.error('Employee created successfully but email notification failed:', {
          employeeId: employee.id,
          email: email,
          error: emailError?.message,
        });
      }
    }

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Unexpected error' },
      { status: 500 },
    );
  }
}
