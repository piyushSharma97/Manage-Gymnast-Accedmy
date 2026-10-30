import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcrypt';
import { NextAuthOptions, Session, User } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from '@/lib/prisma';
import { verifyRecaptchaToken } from '@/lib/recaptcha';

const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember me', type: 'boolean' },
        recaptchaToken: { label: 'reCAPTCHA', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials || !credentials.email || !credentials.password) {
          throw new Error(
            JSON.stringify({
              code: 400,
              message: 'Please enter both email and password.',
            }),
          );
        }

        const recaptchaToken =
          typeof credentials.recaptchaToken === 'string'
            ? credentials.recaptchaToken.trim()
            : '';
        if (!recaptchaToken) {
          throw new Error(
            JSON.stringify({
              code: 400,
              message: 'Please complete the reCAPTCHA verification.',
            }),
          );
        }
        const recaptchaOk = await verifyRecaptchaToken(recaptchaToken);
        if (!recaptchaOk) {
          throw new Error(
            JSON.stringify({
              code: 400,
              message: 'reCAPTCHA verification failed. Please try again.',
            }),
          );
        }

        // Trim and normalize to avoid proxy/load balancer or encoding differences (server vs local)
        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password.trim().normalize('NFC');

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            tenant: {
              select: {
                id: true,
                academyName: true,
                academyCode: true,
                isActive: true,
                subscriptionStatus: true,
                subscriptionEndDate: true,
              },
            },
            location: {
              select: {
                id: true,
                centerName: true,
                centerCode: true,
                isActive: true,
                city: true,
                state: true,
                country: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error(
            JSON.stringify({
              code: 404,
              message: 'User not found. Please register first.',
            }),
          );
        }

        // User has no password set (e.g. OAuth-only or manual DB insert)
        if (!user.password || user.password.length < 10) {
          throw new Error(
            JSON.stringify({
              code: 401,
              message:
                'No password set for this account. Please use "Forgot password" or sign in with Google.',
            }),
          );
        }

        let isPasswordValid = false;
        try {
          isPasswordValid = await bcrypt.compare(password, user.password);
        } catch (err) {
          console.error('[auth] bcrypt.compare error:', err);
          throw new Error(
            JSON.stringify({
              code: 500,
              message: 'Authentication error. Please try again later.',
            }),
          );
        }

        if (!isPasswordValid) {
          throw new Error(
            JSON.stringify({
              code: 401,
              message: 'Invalid credentials. Incorrect password.',
            }),
          );
        }

        if (user.status !== 'ACTIVE') {
          throw new Error(
            JSON.stringify({
              code: 403,
              message: 'Account not activated. Please verify your email.',
            }),
          );
        }

        // Check if user is linked to an employee and if that employee is active
        const employee = await prisma.employee.findFirst({
          where: {
            userId: user.id,
          },
          select: {
            id: true,
            isActive: true,
          },
        });

        if (employee && !employee.isActive) {
          throw new Error(
            JSON.stringify({
              code: 403,
              message: 'Your employee account has been deactivated. Please contact your administrator.',
            }),
          );
        }

        // Check if user is associated with an inactive student
        // Resolve academy (tenant) for parent/guardian: from user.tenantId or from Guardian's tenant
        let resolvedTenantId: number | null = user.tenantId;
        let resolvedTenant = user.tenant;

        if (user.role.slug === 'parent' || user.role.slug === 'guardian') {
          const guardian = await prisma.guardian.findFirst({
            where: { userId: user.id },
            include: {
              tenant: {
                select: {
                  id: true,
                  academyName: true,
                  academyCode: true,
                  isActive: true,
                  subscriptionStatus: true,
                  subscriptionEndDate: true,
                },
              },
              studentguardians: {
                include: {
                  student: {
                    select: {
                      id: true,
                      status: true,
                      firstName: true,
                      lastName: true,
                      deletedAt: true,
                    },
                  },
                },
              },
            },
          });

          if (guardian) {
            // Use academy from guardian when user has no tenantId (parent linked via guardian only)
            if (!resolvedTenantId && guardian.tenant) {
              resolvedTenantId = guardian.tenant.id;
              resolvedTenant = guardian.tenant;
            }

            const inactiveStudents = guardian.studentguardians.filter(
              (sg) => sg.student.status === 'INACTIVE' && !sg.student.deletedAt
            );

            if (inactiveStudents.length > 0) {
              const studentNames = inactiveStudents
                .map((sg) => `${sg.student.firstName} ${sg.student.lastName || ''}`.trim())
                .join(', ');
              throw new Error(
                JSON.stringify({
                  code: 403,
                  message: `Cannot login. The following student(s) are inactive: ${studentNames}. Please contact the academy.`,
                }),
              );
            }
          }
        }

        // Check if user is directly linked to a student (via Student.userId)
        const linkedStudent = await prisma.student.findFirst({
          where: {
            userId: user.id,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
            firstName: true,
            lastName: true,
          },
        });

        if (linkedStudent && linkedStudent.status === 'INACTIVE') {
          throw new Error(
            JSON.stringify({
              code: 403,
              message: 'Cannot login. Your student account is inactive. Please contact the academy.',
            }),
          );
        }

        // Check if academy (tenant) is connected and valid for academy roles (admin, coach, manager, parent, guardian, staff)
        // Owner is platform owner, not academy-specific, so excluded from these checks
        const academyRoles = ['admin', 'manager', 'staff', 'coach', 'parent', 'guardian'];
        if (
          resolvedTenantId &&
          resolvedTenant &&
          academyRoles.includes(user.role.slug)
        ) {
          // Check if academy is inactive
          if (!resolvedTenant.isActive) {
            throw new Error(
              JSON.stringify({
                code: 403,
                message: 'Your academy account is inactive. Please contact support.',
              }),
            );
          }

          // Check if subscription has ended (subscription end date passed)
          const subscriptionEndDate = resolvedTenant.subscriptionEndDate;
          if (subscriptionEndDate && new Date(subscriptionEndDate) < new Date()) {
            throw new Error(
              JSON.stringify({
                code: 403,
                message: 'Your academy subscription has expired. Please contact support to renew.',
              }),
            );
          }

          // Check if subscription is suspended or cancelled
          if (
            resolvedTenant.subscriptionStatus === 'suspended' ||
            resolvedTenant.subscriptionStatus === 'cancelled'
          ) {
            const statusMessage =
              resolvedTenant.subscriptionStatus === 'suspended'
                ? 'suspended'
                : 'cancelled';
            throw new Error(
              JSON.stringify({
                code: 403,
                message: `Your academy subscription has been ${statusMessage}. Please contact support to reactivate your account.`,
              }),
            );
          }
        }

        // Update `lastSignInAt` field
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSignInAt: new Date() },
        });

        // For academy admin: ensure we know if tenant has at least one location (required for first-time setup)
        let tenantHasLocations = true;
        if (user.role.slug === 'admin' && resolvedTenantId) {
          const locationCount = await prisma.location.count({
            where: { tenantId: resolvedTenantId },
          });
          tenantHasLocations = locationCount > 0;
        }

        return ({
          id: user.id.toString(),
          status: user.status,
          email: user.email,
          name: user.name || 'Anonymous',
          roleId: user.roleId,
          roleName: user.role.name,
          roleSlug: user.role.slug,
          avatar: user.avatar,
          tenantId: resolvedTenantId,
          locationId: user.locationId,
          tenant: resolvedTenant,
          location: user.location,
          tenantHasLocations,
        } as unknown) as User;
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      async profile(profile) {
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            tenant: {
              select: {
                id: true,
                academyName: true,
                academyCode: true,
                isActive: true,
                subscriptionStatus: true,
                subscriptionEndDate: true,
              },
            },
            location: {
              select: {
                id: true,
                centerName: true,
                centerCode: true,
                isActive: true,
                city: true,
                state: true,
                country: true,
              },
            },
          },
        });

        if (existingUser) {
          // Resolve academy (tenant) for parent/guardian: from user.tenantId or from Guardian's tenant
          let existingResolvedTenantId: number | null = existingUser.tenantId;
          let existingResolvedTenant = existingUser.tenant;

          if (existingUser.role.slug === 'parent' || existingUser.role.slug === 'guardian') {
            const guardian = await prisma.guardian.findFirst({
              where: { userId: existingUser.id },
              include: {
                tenant: {
                  select: {
                    id: true,
                    academyName: true,
                    academyCode: true,
                    isActive: true,
                    subscriptionStatus: true,
                    subscriptionEndDate: true,
                  },
                },
                studentguardians: {
                  include: {
                    student: {
                      select: {
                        id: true,
                        status: true,
                        firstName: true,
                        lastName: true,
                        deletedAt: true,
                      },
                    },
                  },
                },
              },
            });

            if (guardian) {
              if (!existingResolvedTenantId && guardian.tenant) {
                existingResolvedTenantId = guardian.tenant.id;
                existingResolvedTenant = guardian.tenant;
              }

              const inactiveStudents = guardian.studentguardians.filter(
                (sg) => sg.student.status === 'INACTIVE' && !sg.student.deletedAt
              );

              if (inactiveStudents.length > 0) {
                const studentNames = inactiveStudents
                  .map((sg) => `${sg.student.firstName} ${sg.student.lastName || ''}`.trim())
                  .join(', ');
                throw new Error(
                  JSON.stringify({
                    code: 403,
                    message: `Cannot login. The following student(s) are inactive: ${studentNames}. Please contact the academy.`,
                  }),
                );
              }
            }
          }

          // Check if user is directly linked to a student (via Student.userId)
          const linkedStudent = await prisma.student.findFirst({
            where: {
              userId: existingUser.id,
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              firstName: true,
              lastName: true,
            },
          });

          if (linkedStudent && linkedStudent.status === 'INACTIVE') {
            throw new Error(
              JSON.stringify({
                code: 403,
                message: 'Cannot login. Your student account is inactive. Please contact the academy.',
              }),
            );
          }

          // Check if academy (tenant) is connected and valid for academy roles
          const academyRoles = ['admin', 'manager', 'staff', 'coach', 'parent', 'guardian'];
          if (
            existingResolvedTenantId &&
            existingResolvedTenant &&
            academyRoles.includes(existingUser.role.slug)
          ) {
            if (!existingResolvedTenant.isActive) {
              throw new Error(
                JSON.stringify({
                  code: 403,
                  message: 'Your academy account is inactive. Please contact support.',
                }),
              );
            }

            const subscriptionEndDate = existingResolvedTenant.subscriptionEndDate;
            if (subscriptionEndDate && new Date(subscriptionEndDate) < new Date()) {
              throw new Error(
                JSON.stringify({
                  code: 403,
                  message: 'Your academy subscription has expired. Please contact support to renew.',
                }),
              );
            }

            if (
              existingResolvedTenant.subscriptionStatus === 'suspended' ||
              existingResolvedTenant.subscriptionStatus === 'cancelled'
            ) {
              const statusMessage =
                existingResolvedTenant.subscriptionStatus === 'suspended'
                  ? 'suspended'
                  : 'cancelled';
              throw new Error(
                JSON.stringify({
                  code: 403,
                  message: `Your academy subscription has been ${statusMessage}. Please contact support to reactivate your account.`,
                }),
              );
            }
          }

          // Update `lastSignInAt` field for existing users
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: profile.name,
              avatar: profile.picture || null,
              lastSignInAt: new Date(),
            },
          });

          // For academy admin: ensure we know if tenant has at least one location
          let tenantHasLocations = true;
          if (existingUser.role.slug === 'admin' && existingResolvedTenantId) {
            const locationCount = await prisma.location.count({
              where: { tenantId: existingResolvedTenantId },
            });
            tenantHasLocations = locationCount > 0;
          }

          return ({
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name || 'Anonymous',
            status: existingUser.status,
            roleId: existingUser.roleId,
            roleName: existingUser.role.name,
            roleSlug: existingUser.role.slug,
            avatar: existingUser.avatar,
            tenantId: existingResolvedTenantId,
            locationId: existingUser.locationId,
            tenant: existingResolvedTenant,
            location: existingUser.location,
            tenantHasLocations,
          } as unknown) as User;
        }

        const defaultRole = await prisma.userRole.findFirst({
          where: { slug: 'default' },
        });

        if (!defaultRole) {
          throw new Error(
            'Default role not found. Unable to create a new user.',
          );
        }

        // Create a new user and account
        const newUser = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            password: '', // No password for OAuth users
            avatar: profile.picture || null,
            emailVerifiedAt: new Date(),
            roleId: defaultRole.id,
            status: 'ACTIVE',
            createdBy: 'system', 
          },
        });

        return ({
          id: newUser.id,
          email: newUser.email,
          name: newUser.name || 'Anonymous',
          status: newUser.status,
          avatar: newUser.avatar,
          roleId: newUser.roleId,
          roleName: defaultRole.name,
          roleSlug: defaultRole.slug,
          tenantId: newUser.tenantId,
          locationId: newUser.locationId,
          tenant: null,
          location: null,
        } as unknown) as User;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({
      token,
      user,
      session,
      trigger,
    }: {
      token: JWT;
      user: User;
      session?: Session;
      trigger?: 'signIn' | 'signUp' | 'update';
    }) {
      if (trigger === 'update' && session?.user) {
        token = session.user;
        const u = session.user as { tenantHasLocations?: boolean };
        if (u.tenantHasLocations !== undefined) token.tenantHasLocations = u.tenantHasLocations;
      } else {
        if (user && user.roleId) {
          const role = await prisma.userRole.findUnique({
            where: { id: Number(user.roleId) },
          });

          token.id = (user.id || token.sub) as string;
          token.email = user.email;
          token.name = user.name;
          token.avatar = user.avatar;
          token.status = user.status;
          token.roleId = Number(user.roleId);
          token.roleName = role?.name;
          token.roleSlug = role?.slug;
          token.tenantId = user.tenantId;
          token.locationId = user.locationId;
          token.tenant = user.tenant;
          token.location = user.location;
          token.tenantHasLocations = (user as User & { tenantHasLocations?: boolean }).tenantHasLocations;
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.avatar = token.avatar;
        session.user.status = token.status;
        session.user.roleId = token.roleId;
        session.user.roleName = token.roleName;
        session.user.roleSlug = token.roleSlug;
        session.user.tenantId = token.tenantId;
        session.user.locationId = token.locationId;
        session.user.tenant = token.tenant;
        session.user.location = token.location;
        session.user.tenantHasLocations = token.tenantHasLocations;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
  },
};

export default authOptions;
