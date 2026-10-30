import { ReactNode } from 'react';

export default function ExternalRegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#e8e0ff] via-[#d4c4fc] to-[#b8a3f0] px-4 py-8 sm:py-10">
      <div className="w-full max-w-lg shrink-0">{children}</div>
    </div>
  );
}
