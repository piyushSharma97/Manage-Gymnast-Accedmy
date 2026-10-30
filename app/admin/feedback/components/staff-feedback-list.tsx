'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare } from 'lucide-react';

type Thread = {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
  guardian: { firstName: string; lastName: string | null; email: string | null };
  _count: { replies: number };
};

export function StaffFeedbackList({ basePath }: { basePath: '/admin' | '/manager' | '/coach' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['feedback-list', basePath],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.list);
      if (!res.ok) throw new Error('Failed to load feedback');
      const json = await res.json();
      return (json.data ?? []) as Thread[];
    },
  });

  const threads = (data ?? []) as Thread[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Parent feedback
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Messages from parents. Click to view and reply.
        </p>
      </CardHeader>
      <CardContent>
        {threads.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No feedback messages yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {threads.map((t) => {
              const name = [t.guardian.firstName, t.guardian.lastName].filter(Boolean).join(' ');
              return (
                <li key={t.id}>
                  <Link
                    href={`${basePath}/feedback/${t.id}`}
                    className="block rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {t.subject || 'No subject'}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {t.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          From {name || 'Parent'} · {new Date(t.createdAt).toLocaleString()} ·{' '}
                          {t._count.replies} reply{t._count.replies !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-primary text-sm font-medium shrink-0">View →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
