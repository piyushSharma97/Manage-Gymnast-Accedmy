import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      roleId?: number | null;
      roleName?: string | null;
      roleSlug?: string | null;
      tenantId?: number | null;
      locationId?: number | null;
      tenant?: {
        id: number;
        academyName: string;
        academyCode: string;
        isActive: boolean;
        subscriptionStatus: string;
      } | null;
      location?: {
        id: number;
        centerName: string;
        centerCode: string;
        isActive: boolean;
        city?: string;
        state?: string;
        country?: string;
      } | null;
      tenantHasLocations?: boolean;
      status: string;
    };
  }

  interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    roleId?: number | null;
    roleName?: string | null;
    roleSlug?: string | null;
    tenantId?: number | null;
    locationId?: number | null;
    tenant?: {
      id: number;
      academyName: string;
      academyCode: string;
      isActive: boolean;
      subscriptionStatus: string;
    } | null;
    location?: {
      id: number;
      centerName: string;
      centerCode: string;
      isActive: boolean;
      city?: string;
      state?: string;
      country?: string;
    } | null;
    tenantHasLocations?: boolean;
    status: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    roleId?: number | null;
    roleName?: string | null;
    roleSlug?: string | null;
    tenantId?: number | null;
    locationId?: number | null;
    tenant?: {
      id: number;
      academyName: string;
      academyCode: string;
      isActive: boolean;
      subscriptionStatus: string;
    } | null;
    location?: {
      id: number;
      centerName: string;
      centerCode: string;
      isActive: boolean;
      city?: string;
      state?: string;
      country?: string;
    } | null;
    tenantHasLocations?: boolean;
    status: string;
  }
}
