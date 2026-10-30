'use client';

import { useTenant } from '@/hooks/use-tenant';
import { useUserInfo } from '@/hooks/use-tenant';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  MapPin, 
  User, 
  Settings, 
  LogOut,
  Shield
} from 'lucide-react';
import { signOut } from 'next-auth/react';

export function TenantHeader() {
  const { tenant, location, isOwner, isAdmin, isManager } = useTenant();
  const { tenantName, locationName, accessLevel } = useUserInfo();

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b">
      {/* Tenant Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tenantName}
            </h1>
            {location && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationName}
              </p>
            )}
          </div>
        </div>
        
        <Badge 
          variant={isOwner ? 'default' : isAdmin ? 'secondary' : 'outline'}
          className="text-xs"
        >
          <Shield className="h-3 w-3 mr-1" />
          {accessLevel}
        </Badge>
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src="/avatars/01.png" alt="User" />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">User</p>
              <p className="text-xs leading-none text-muted-foreground">
                {tenantName}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
