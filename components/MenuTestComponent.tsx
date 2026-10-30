import React, { useState } from 'react';
import { useMenuAccess } from '@/hooks/useMenuAccess';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { Menu } from '@/components/Menu';
import { User } from '@/utils/menuUtils';
import { ROLES } from '@/constants/roles';

export function MenuTestComponent() {
  const [selectedRole, setSelectedRole] = useState<User['roles'][0]>(ROLES.ADMIN);
  
  // Mock user with selected role
  const mockUser: User = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    roles: [selectedRole]
  };

  const accessibleMenu = useMenuAccess(mockUser, MENU_SIDEBAR);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Role-Based Menu Test</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select User Role:
        </label>
        <select 
          value={selectedRole} 
          onChange={(e) => setSelectedRole(e.target.value as User['roles'][0])}
          className="border border-gray-300 rounded-md px-3 py-2"
        >
          <option value={ROLES.OWNER}>Owner</option>
          <option value={ROLES.ADMIN}>Admin</option>
          <option value={ROLES.MANAGER}>Manager</option>
          <option value={ROLES.STAFF}>Staff</option>
          <option value={ROLES.MEMBER}>Member</option>
        </select>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Current user: <strong>{mockUser.name}</strong> with role: <strong>{selectedRole}</strong>
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Accessible Menu Items:</h2>
        <Menu menu={accessibleMenu} user={mockUser} />
      </div>
    </div>
  );
}
