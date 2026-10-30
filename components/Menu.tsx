import React from 'react';
import { MenuItem as MenuItemType, MenuConfig } from '@/config/types';
import type { UserRole } from '@/constants/roles';
import { User } from '@/utils/menuUtils';

interface MenuItemProps {
  item: MenuItemType;
  user: User | null;
  level?: number;
}

export function MenuItem({ item, user, level = 0 }: MenuItemProps) {
  // Check if user has access to this menu item
  const hasAccess = !item.roles || item.roles.length === 0 || 
    (user && item.roles.some(role => user.roles.includes(role as UserRole)));

  if (!hasAccess) {
    return null;
  }

  if (item.heading) {
    return (
      <h3 className={`menu-heading text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ${
        level > 0 ? 'ml-4' : ''
      }`}>
        {item.heading}
      </h3>
    );
  }

  if (item.separator) {
    return <hr className="menu-separator my-2 border-gray-200" />;
  }

  const Icon = item.icon;

  return (
    <div className="menu-item">
      {item.path ? (
        <a 
          href={item.path} 
          className={`menu-link flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            level > 0 ? 'ml-4' : ''
          } hover:bg-gray-100 hover:text-gray-900`}
        >
          {Icon && <Icon className="mr-3 h-5 w-5" />}
          <span>{item.title}</span>
          {item.badge && (
            <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {item.badge}
            </span>
          )}
        </a>
      ) : (
        <div className={`menu-group ${level > 0 ? 'ml-4' : ''}`}>
          <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-700">
            {Icon && <Icon className="mr-3 h-5 w-5" />}
            <span>{item.title}</span>
          </div>
        </div>
      )}
      
      {item.children && item.children.length > 0 && (
        <div className="menu-children ml-4">
          {item.children.map((child, index) => (
            <MenuItem 
              key={index} 
              item={child} 
              user={user} 
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MenuProps {
  menu: MenuConfig;
  user: User | null;
  className?: string;
}

export function Menu({ menu, user, className = '' }: MenuProps) {
  return (
    <nav className={`menu ${className}`}>
      {menu.map((item: MenuItemType, index: number) => (
        <MenuItem key={index} item={item} user={user} />
      ))}
    </nav>
  );
}
