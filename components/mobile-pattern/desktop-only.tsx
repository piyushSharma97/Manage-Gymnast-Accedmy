'use client';

import type { ReactNode } from 'react';

/** Hides content below `lg` so mobile can use stack headers + pattern lists inside the feature. */
export function DesktopOnly({ children }: { children: ReactNode }) {
  return <div className="hidden lg:block">{children}</div>;
}
