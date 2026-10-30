'use client';

import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Ruler } from 'lucide-react';
import Link from 'next/link';

export default function ParentTrackerHeightWeightPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-tracker-height-weight', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.tracker.heightWeight, `studentId=${studentId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: isReady && !!studentId,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!studentId) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-muted-foreground mb-4">Select a child to view height & weight.</p>
          <Link href="/parent/children" className="text-primary font-medium hover:underline">
            Select child &rarr;
          </Link>
        </div>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">Could not load height/weight.</p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">Back</Link>
        </div>
      </Container>
    );
  }

  const list = data?.data ?? [];

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Ruler className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">Height & Weight</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recorded measurements</CardTitle>
          <p className="text-sm text-muted-foreground">
            Height and weight are typically recorded at assessment events.
          </p>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No height/weight records yet. Records are added at events (e.g. assessments).
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Event</th>
                    <th className="text-left p-3 font-medium">Height (cm)</th>
                    <th className="text-left p-3 font-medium">Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((row: { id: number; date: string; eventName: string; height: number | null; weight: number | null }) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="p-3">{row.date}</td>
                      <td className="p-3 text-muted-foreground">{row.eventName ?? '—'}</td>
                      <td className="p-3">{row.height != null ? row.height : '—'}</td>
                      <td className="p-3">{row.weight != null ? row.weight : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
