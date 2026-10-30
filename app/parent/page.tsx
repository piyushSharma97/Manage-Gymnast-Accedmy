'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { ScreenLoader } from '@/components/common/screen-loader';

export default function ParentPage() {
  const router = useRouter();
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.parent.children);
      if (!res.ok) throw new Error('Failed to fetch children');
      return res.json();
    },
  });

  const children = data?.data ?? [];

  useEffect(() => {
    if (isLoading || error) return;
    if (children.length === 0) {
      // No children linked - show a message or stay on this page
      return;
    }
    if (children.length === 1) {
      router.replace('/parent/dashboard');
      return;
    }
    router.replace('/parent/children');
  }, [children, isLoading, error, router]);

  if (error) {
    return (
      <div className="w-full py-12 px-4 sm:px-6 text-center">
        <p className="text-destructive">Unable to load your children. Please try again later.</p>
      </div>
    );
  }

  return <ScreenLoader />;
}
