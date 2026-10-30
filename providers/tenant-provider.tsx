'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { TenantContext, useTenant } from '@/hooks/use-tenant';

interface TenantProviderProps {
  children: React.ReactNode;
}

const TenantContextProvider = createContext<TenantContext | null>(null);

export function TenantProvider({ children }: TenantProviderProps) {
  const tenantContext = useTenant();

  const value = useMemo(() => tenantContext, [tenantContext]);

  return (
    <TenantContextProvider.Provider value={value}>
      {children}
    </TenantContextProvider.Provider>
  );
}

export function useTenantContext(): TenantContext {
  const context = useContext(TenantContextProvider);
  
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  
  return context;
}

/**
 * Higher-order component to wrap components with tenant context
 */
export function withTenantContext<P extends object>(
  Component: React.ComponentType<P>
) {
  return function TenantWrappedComponent(props: P) {
    return (
      <TenantProvider>
        <Component {...props} />
      </TenantProvider>
    );
  };
}

/**
 * Hook to get tenant-aware API parameters
 */
export function useTenantApiParams() {
  const tenantContext = useTenantContext();

  return useMemo(() => {
    const params: Record<string, any> = {};

    // Add tenant filter for non-owner users
    if (!tenantContext.isOwner && tenantContext.tenant?.id) {
      params.tenantId = tenantContext.tenant.id;
    }

    // Add location filter for managers
    if (tenantContext.isManager && tenantContext.location?.id) {
      params.locationId = tenantContext.location.id;
    }

    return params;
  }, [tenantContext]);
}

/**
 * Hook to get tenant-aware headers for API calls
 */
export function useTenantHeaders() {
  const tenantContext = useTenantContext();

  return useMemo(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (tenantContext.user.id) {
      headers['x-user-id'] = tenantContext.user.id;
    }

    if (tenantContext.user.roleSlug) {
      headers['x-user-role'] = tenantContext.user.roleSlug;
    }

    if (tenantContext.tenant?.id) {
      headers['x-tenant-id'] = tenantContext.tenant.id.toString();
    }

    if (tenantContext.location?.id) {
      headers['x-location-id'] = tenantContext.location.id.toString();
    }

    return headers;
  }, [tenantContext]);
}

/**
 * Hook to get tenant-aware fetch function
 */
export function useTenantFetch() {
  const headers = useTenantHeaders();

  return useMemo(() => {
    return async (url: string, options: RequestInit = {}) => {
      return fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });
    };
  }, [headers]);
}
