import { ReactNode } from 'react';

/**
 * Standalone shell: no app sidebar or role navigation — single-purpose registration only.
 */
export default function StudentRegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] min-h-screen w-full flex-col items-center bg-gradient-to-br from-[#e8e0ff] via-[#d4c4fc] to-[#b8a3f0] px-4 py-8 sm:py-10">
      <div className="w-full max-w-3xl shrink-0">{children}</div>
    </div>
  );
}
