import React from 'react';
import { useMenuAccess } from '@/hooks/useMenuAccess';
import { MENU_SIDEBAR } from '@/config/menu.config';
import { Menu } from '@/components/Menu';
import { User } from '@/utils/menuUtils';

// This would typically come from your auth context or API
interface SidebarProps {
  user: User | null;
}

export function Sidebar({ user }: SidebarProps) {
  const accessibleMenu = useMenuAccess(user, MENU_SIDEBAR);
  
  return (
    <div className="sidebar bg-white shadow-lg h-full">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {user ? `Welcome, ${user.name}` : 'Menu'}
        </h2>
        
        <Menu menu={accessibleMenu} user={user} />
      </div>
    </div>
  );
}

// Example usage in your main layout
export function LayoutWithSidebar() {
  // This would come from your authentication system
  const user: User | null = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    roles: ['admin', 'manager'] // User's roles
  };

  return (
    <div className="flex h-screen">
      <Sidebar user={user} />
      <main className="flex-1 p-6">
        {/* Your main content */}
        <h1>Main Content Area</h1>
      </main>
    </div>
  );
}
