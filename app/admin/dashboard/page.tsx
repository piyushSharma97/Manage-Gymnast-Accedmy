'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenLoader } from '@/components/common/screen-loader';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/dashboard/batch');
  }, [router]);

  return <ScreenLoader />;
}