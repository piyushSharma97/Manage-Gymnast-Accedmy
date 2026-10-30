'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTenant } from '@/hooks/use-tenant';
import { Button } from '@/components/ui/button';
import { Copy, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * Link + copy for the public parent-facing student registration URL (tenant academy code).
 */
export function ExternalStudentRegistrationLink({ className }: { className?: string }) {
  const { tenant } = useTenant();
  const code = tenant?.academyCode?.trim();

  const href = useMemo(() => {
    if (!code) return '';
    return `${basePath}/student-register/${encodeURIComponent(code)}`;
  }, [code]);

  const fullUrl = useMemo(() => {
    if (typeof window === 'undefined' || !href) return '';
    return `${window.location.origin}${href}`;
  }, [href]);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl || href);
      toast.success('External registration link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className ?? ''}`}>
      <Button variant="outline" size="sm" className="h-9" asChild>
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <Link2 className="mr-1.5 h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">External registration</span>
          <span className="sm:hidden">Ext. reg.</span>
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={copy}
        title="Copy registration link"
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
