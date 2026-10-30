import { MenuConfig } from '@/config/types';
import { User, filterMenu, filterMenuWithPermissions, canAccessPath } from '@/utils/menuUtils';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { ROLES } from '@/constants/roles';

// Test data
const mockUsers: Record<string, User> = {
  owner: {
    id: '1',
    name: 'Owner User',
    email: 'owner@example.com',
    roles: ['owner'],
    tenantId: 1,
    locationId: 1
  },
  admin: {
    id: '2',
    name: 'Admin User',
    email: 'admin@example.com',
    roles: ['admin'],
    tenantId: 1,
    locationId: 1
  },
  manager: {
    id: '3',
    name: 'Manager User',
    email: 'manager@example.com',
    roles: ['manager'],
    tenantId: 1,
    locationId: 1
  },
  staff: {
    id: '4',
    name: 'Staff User',
    email: 'staff@example.com',
    roles: ['staff'],
    tenantId: 1,
    locationId: 1
  },
  member: {
    id: '5',
    name: 'Member User',
    email: 'member@example.com',
    roles: ['member'],
    tenantId: 1,
    locationId: 1
  },
  multiRole: {
    id: '6',
    name: 'Multi Role User',
    email: 'multi@example.com',
    roles: ['admin', 'manager'],
    tenantId: 1,
    locationId: 1
  }
};

const tenantContexts = {
  withTenant: { tenantId: 1, locationId: 1 },
  withLocation: { tenantId: 1, locationId: 2 },
  withoutContext: {}
};

// Test functions
export function testMenuFiltering() {
  console.log('🧪 Testing Role-Based Menu Filtering System\n');

  // Test 1: Owner access
  console.log('Test 1: Owner Access');
  const ownerMenu = filterMenu(MENU_SIDEBAR, mockUsers.owner);
  console.log('Owner menu items:', ownerMenu.length);
  console.log('Owner can access:', ownerMenu.map(item => item.title));
  console.log('');

  // Test 2: Admin access
  console.log('Test 2: Admin Access');
  const adminMenu = filterMenu(MENU_SIDEBAR, mockUsers.admin);
  console.log('Admin menu items:', adminMenu.length);
  console.log('Admin can access:', adminMenu.map(item => item.title));
  console.log('');

  // Test 3: Manager access
  console.log('Test 3: Manager Access');
  const managerMenu = filterMenu(MENU_SIDEBAR, mockUsers.manager);
  console.log('Manager menu items:', managerMenu.length);
  console.log('Manager can access:', managerMenu.map(item => item.title));
  console.log('');

  // Test 4: Staff access
  console.log('Test 4: Staff Access');
  const staffMenu = filterMenu(MENU_SIDEBAR, mockUsers.staff);
  console.log('Staff menu items:', staffMenu.length);
  console.log('Staff can access:', staffMenu.map(item => item.title));
  console.log('');

  // Test 5: Member access
  console.log('Test 5: Member Access');
  const memberMenu = filterMenu(MENU_SIDEBAR, mockUsers.member);
  console.log('Member menu items:', memberMenu.length);
  console.log('Member can access:', memberMenu.map(item => item.title));
  console.log('');

  // Test 6: Multi-role user
  console.log('Test 6: Multi-Role User');
  const multiRoleMenu = filterMenu(MENU_SIDEBAR, mockUsers.multiRole);
  console.log('Multi-role menu items:', multiRoleMenu.length);
  console.log('Multi-role can access:', multiRoleMenu.map(item => item.title));
  console.log('');

  // Test 7: Unauthenticated user
  console.log('Test 7: Unauthenticated User');
  const unauthenticatedMenu = filterMenu(MENU_SIDEBAR, null);
  console.log('Unauthenticated menu items:', unauthenticatedMenu.length);
  console.log('Unauthenticated can access:', unauthenticatedMenu.map(item => item.title));
  console.log('');
}

export function testPathAccess() {
  console.log('🧪 Testing Path Access\n');

  const testPaths = [
    '/admin/dashboard/batch',
    '/owner/tenant-management',
    '/admin/location',
    '/user-management/roles',
    '/user-management/users'
  ];

  Object.entries(mockUsers).forEach(([userType, user]) => {
    console.log(`${userType.charAt(0).toUpperCase() + userType.slice(1)} Path Access:`);
    testPaths.forEach(path => {
      const canAccess = canAccessPath(user, path, MENU_SIDEBAR);
      console.log(`  ${path}: ${canAccess ? '✅' : '❌'}`);
    });
    console.log('');
  });
}

export function testTenantContextFiltering() {
  console.log('🧪 Testing Tenant Context Filtering\n');

  const testUser = mockUsers.admin;

  Object.entries(tenantContexts).forEach(([contextType, context]) => {
    console.log(`Context: ${contextType}`);
    const filteredMenu = filterMenuWithPermissions(MENU_SIDEBAR, testUser, context);
    console.log(`Menu items with context: ${filteredMenu.length}`);
    
    // Check specific items that require tenant/location
    const adminItems = filteredMenu.find(item => item.title === 'Administration');
    if (adminItems?.children) {
      const tenantRequiredItems = adminItems.children.filter(item => 
        item.requiresActiveTenant || item.requiresActiveLocation
      );
      console.log(`Tenant/Location required items: ${tenantRequiredItems.length}`);
    }
    console.log('');
  });
}

export function testRoleHierarchy() {
  console.log('🧪 Testing Role Hierarchy\n');

  // Test that higher roles can access lower role items
  const hierarchyTests = [
    { user: mockUsers.owner, shouldAccess: ['admin', 'manager', 'staff', 'member'] },
    { user: mockUsers.admin, shouldAccess: ['manager', 'staff', 'member'] },
    { user: mockUsers.manager, shouldAccess: ['staff', 'member'] },
    { user: mockUsers.staff, shouldAccess: ['member'] },
    { user: mockUsers.member, shouldAccess: [] }
  ];

  hierarchyTests.forEach(({ user, shouldAccess }) => {
    console.log(`${user.roles[0]} hierarchy test:`);
    shouldAccess.forEach(role => {
      const testMenu: MenuConfig = [{
        title: `Test ${role}`,
        path: `/test/${role}`,
        roles: [role as any]
      }];
      
      const filteredMenu = filterMenu(testMenu, user);
      const canAccess = filteredMenu.length > 0;
      console.log(`  Can access ${role} items: ${canAccess ? '✅' : '❌'}`);
    });
    console.log('');
  });
}

export function testEdgeCases() {
  console.log('🧪 Testing Edge Cases\n');

  // Test 1: Empty roles array
  console.log('Test 1: Empty roles array');
  const emptyRolesUser: User = {
    id: '7',
    name: 'Empty Roles User',
    email: 'empty@example.com',
    roles: []
  };
  const emptyRolesMenu = filterMenu(MENU_SIDEBAR, emptyRolesUser);
  console.log(`Empty roles menu items: ${emptyRolesMenu.length}`);
  console.log('');

  // Test 2: Invalid role
  console.log('Test 2: Invalid role');
  const invalidRoleUser: User = {
    id: '8',
    name: 'Invalid Role User',
    email: 'invalid@example.com',
    roles: ['invalid_role' as any]
  };
  const invalidRoleMenu = filterMenu(MENU_SIDEBAR, invalidRoleUser);
  console.log(`Invalid role menu items: ${invalidRoleMenu.length}`);
  console.log('');

  // Test 3: Menu item without roles
  console.log('Test 3: Menu item without roles');
  const menuWithoutRoles: MenuConfig = [{
    title: 'No Roles Item',
    path: '/no-roles'
    // No roles specified
  }];
  const noRolesMenu = filterMenu(menuWithoutRoles, mockUsers.admin);
  console.log(`Menu without roles items: ${noRolesMenu.length}`);
  console.log('');

  // Test 4: Nested children filtering
  console.log('Test 4: Nested children filtering');
  const nestedMenu: MenuConfig = [{
    title: 'Parent',
    roles: ['admin'],
    children: [
      { title: 'Child 1', path: '/child1', roles: ['admin'] },
      { title: 'Child 2', path: '/child2', roles: ['owner'] },
      { title: 'Child 3', path: '/child3', roles: ['manager'] }
    ]
  }];
  
  const adminNestedMenu = filterMenu(nestedMenu, mockUsers.admin);
  const managerNestedMenu = filterMenu(nestedMenu, mockUsers.manager);
  
  console.log(`Admin nested menu children: ${adminNestedMenu[0]?.children?.length || 0}`);
  console.log(`Manager nested menu children: ${managerNestedMenu[0]?.children?.length || 0}`);
  console.log('');
}

// Run all tests
export function runAllTests() {
  testMenuFiltering();
  testPathAccess();
  testTenantContextFiltering();
  testRoleHierarchy();
  testEdgeCases();
  
  console.log('🎉 All tests completed!');
}

// Export for use in development
export const menuFilteringTests = {
  testMenuFiltering,
  testPathAccess,
  testTenantContextFiltering,
  testRoleHierarchy,
  testEdgeCases,
  runAllTests
};
