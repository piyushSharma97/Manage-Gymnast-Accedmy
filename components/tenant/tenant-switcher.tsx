'use client';

import { useTenant } from '@/hooks/use-tenant';
import { API_PATHS } from '@/lib/api-paths';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Check, 
  ChevronsUpDown,
  MapPin,
  Users,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tenant {
  id: number;
  academyName: string;
  academyCode: string;
  subscriptionStatus: string;
  _count: {
    locations: number;
    students: number;
    employees: number;
  };
}

export function TenantSwitcher() {
  const { isOwner, tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOwner) {
      fetchTenants();
    }
  }, [isOwner]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_PATHS.owner.tenants);
      if (response.ok) {
        const data = await response.json();
        setTenants(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSelect = async (tenantId: number) => {
    try {
      // Update current tenant context
      const response = await fetch(API_PATHS.tenant.switch, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });
      
      if (response.ok) {
        // Reload page to update context
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  };

  if (!isOwner) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="truncate">
              {tenant?.academyName || 'Select Tenant'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search tenants..." />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading tenants...' : 'No tenants found.'}
            </CommandEmpty>
            <CommandGroup>
              {tenants.map((tenantItem) => (
                <CommandItem
                  key={tenantItem.id}
                  value={tenantItem.academyName}
                  onSelect={() => {
                    handleTenantSelect(tenantItem.id);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {tenantItem.academyName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tenantItem.academyCode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={tenantItem.subscriptionStatus === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {tenantItem.subscriptionStatus}
                    </Badge>
                    {tenant?.id === tenantItem.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
