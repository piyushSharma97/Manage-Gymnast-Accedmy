'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import {
  parentSelectedStudentStorageKey,
  readParentSelectedStudentId,
  writeParentSelectedStudentId,
} from '@/lib/parent-selected-student-storage';

export type ParentChildOption = { id: string; name: string; level: string | null };

type ParentSelectedStudentContextValue = {
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string) => void;
  childrenList: ParentChildOption[];
  isReady: boolean;
};

const ParentSelectedStudentContext =
  createContext<ParentSelectedStudentContextValue | null>(null);

export function useParentSelectedStudent() {
  const ctx = useContext(ParentSelectedStudentContext);
  if (!ctx) {
    return {
      selectedStudentId: null as string | null,
      setSelectedStudentId: (_id: string) => {},
      childrenList: [] as ParentChildOption[],
      isReady: true,
    };
  }
  return ctx;
}

export function ParentSelectedStudentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedStudentId, setSelectedStudentIdState] = useState<string | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);

  const { data: childrenData, isSuccess: childrenLoaded } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.parent.children);
      if (!res.ok) throw new Error('Failed to fetch children');
      return res.json();
    },
    enabled: !!userId,
  });

  const childrenList = useMemo(
    () => (childrenData?.data ?? []) as ParentChildOption[],
    [childrenData?.data],
  );
  const childIdsKey = useMemo(
    () =>
      childrenList
        .map((c) => c.id)
        .sort()
        .join(','),
    [childrenList],
  );

  useEffect(() => {
    if (!userId || !childrenLoaded) return;

    const valid = new Set(childrenList.map((c) => c.id));
    if (valid.size === 0) {
      setSelectedStudentIdState(null);
      setIsReady(true);
      return;
    }

    const urlId = searchParams?.get('studentId');
    if (urlId && valid.has(urlId)) {
      writeParentSelectedStudentId(userId, urlId);
      setSelectedStudentIdState(urlId);
      router.replace(pathname);
      setIsReady(true);
      return;
    }

    const stored = readParentSelectedStudentId(userId);
    if (stored && !valid.has(stored)) {
      try {
        window.localStorage.removeItem(parentSelectedStudentStorageKey(userId));
      } catch {
        /* ignore */
      }
    }
    if (stored && valid.has(stored)) {
      setSelectedStudentIdState(stored);
      setIsReady(true);
      return;
    }

    if (childrenList.length === 1) {
      const id = childrenList[0].id;
      writeParentSelectedStudentId(userId, id);
      setSelectedStudentIdState(id);
      setIsReady(true);
      return;
    }

    setSelectedStudentIdState(null);
    setIsReady(true);
  }, [
    userId,
    childrenLoaded,
    childIdsKey,
    childrenList,
    searchParams,
    pathname,
    router,
  ]);

  const setSelectedStudentId = useCallback(
    (id: string) => {
      if (!userId) return;
      const valid = childrenList.some((c) => c.id === id);
      if (!valid) return;
      writeParentSelectedStudentId(userId, id);
      setSelectedStudentIdState(id);
    },
    [userId, childrenList],
  );

  const value = useMemo(
    () => ({
      selectedStudentId,
      setSelectedStudentId,
      childrenList,
      isReady,
    }),
    [selectedStudentId, setSelectedStudentId, childrenList, isReady],
  );

  return (
    <ParentSelectedStudentContext.Provider value={value}>
      {children}
    </ParentSelectedStudentContext.Provider>
  );
}
