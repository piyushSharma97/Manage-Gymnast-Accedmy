// Define your application roles
export const ROLES = {
  OWNER: 'owner',      // Can manage tenants, full system access
  ADMIN: 'admin',      // Can manage users, programs, courses
  MANAGER: 'manager',  // Can manage teams, batches, employees
  STAFF: 'staff',      // Can view and manage assigned batches
  MEMBER: 'member',    // Basic user access
   COACH: 'coach',    // Can manage gymnasts and attendance
  PARENT: 'parent',  // Parent portal - view child progress
  GUARDIAN: 'guardian', // Guardian portal - same as parent
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Role hierarchy - higher roles inherit permissions from lower roles
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  [ROLES.OWNER]: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.MEMBER],
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.MEMBER],
  [ROLES.MANAGER]: [ROLES.MANAGER, ROLES.STAFF, ROLES.MEMBER],
  [ROLES.COACH]: [ROLES.COACH, ROLES.MEMBER],
  [ROLES.STAFF]: [ROLES.STAFF, ROLES.MEMBER],
  [ROLES.MEMBER]: [ROLES.MEMBER],
  [ROLES.PARENT]: [ROLES.PARENT],
  [ROLES.GUARDIAN]: [ROLES.GUARDIAN],
};

// Helper function to check if a role has access to another role
export function hasRoleAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole]?.includes(requiredRole) ?? false;
}

// Helper function to check if user has any of the required roles
export function hasAnyRoleAccess(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
  return requiredRoles.some(requiredRole => 
    userRoles.some(userRole => hasRoleAccess(userRole, requiredRole))
  );
}
