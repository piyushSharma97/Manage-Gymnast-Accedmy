'use client';

import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

interface AuthProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function AuthProvider({ children, session }: AuthProviderProps) {
  // Use relative path so auth API is always same-origin (no CORS when running
  // production build at localhost while NEXT_PUBLIC_BASE_PATH points to production).
  const authBasePath = '/api/auth';
  return (
    <SessionProvider session={session} basePath={authBasePath}>
      {children}
    </SessionProvider>
  );
}
