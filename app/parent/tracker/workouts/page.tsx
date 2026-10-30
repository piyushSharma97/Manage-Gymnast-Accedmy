'use client';

import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Dumbbell, User } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

type WorkoutRow = {
  id: number;
  level: string;
  targetValue: string | null;
  description: string | null;
  skillId: number;
  skillName: string;
  unitOfMeasurement: string;
  categoryId: number | null;
  categoryName: string;
  addedByUserId: string | null;
  addedByName: string | null;
  updatedAt: string | null;
};

export default function ParentWorkoutsPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-tracker-workouts', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.tracker.workouts, `studentId=${studentId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ workouts: WorkoutRow[]; categories: string[]; total: number }>;
    },
    enabled: isReady && !!studentId,
  });

  const grouped = useMemo(() => {
    const workouts = data?.workouts ?? [];
    const byCategory = new Map<string, Map<string, WorkoutRow[]>>();
    for (const w of workouts) {
      if (!byCategory.has(w.categoryName)) {
        byCategory.set(w.categoryName, new Map());
      }
      const cat = byCategory.get(w.categoryName)!;
      if (!cat.has(w.skillName)) {
        cat.set(w.skillName, []);
      }
      cat.get(w.skillName)!.push(w);
    }
    return byCategory;
  }, [data?.workouts]);

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
          <p className="text-muted-foreground mb-4">Select a child to view workouts from your coaches.</p>
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
          <p className="text-destructive">Could not load workouts.</p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">
            Back
          </Link>
        </div>
      </Container>
    );
  }

  const workouts = data?.workouts ?? [];

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Dumbbell className="size-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workout list</h1>
          <p className="text-sm text-muted-foreground">
            Targets and levels added by your academy coaches (same list as Fitness Workouts).
          </p>
        </div>
      </div>

      {workouts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No workouts have been published yet. Your coach can add them under Fitness Workouts.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([categoryName, skillsMap]) => (
              <section key={categoryName}>
                <h2 className="text-lg font-semibold mb-3 border-b border-border pb-2">
                  {categoryName}
                </h2>
                <div className="space-y-6">
                  {Array.from(skillsMap.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([skillName, rows]) => (
                      <Card key={`${categoryName}-${skillName}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{skillName}</CardTitle>
                          {rows[0]?.unitOfMeasurement ? (
                            <p className="text-xs text-muted-foreground font-normal">
                              Unit: {rows[0].unitOfMeasurement}
                            </p>
                          ) : null}
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-3">
                            {rows.map((w) => (
                              <li
                                key={w.id}
                                className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-sm"
                              >
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <Badge variant="secondary" appearance="outline" className="font-medium">
                                    {w.level}
                                  </Badge>
                                  {w.targetValue ? (
                                    <span className="font-medium tabular-nums text-foreground">
                                      Target: {w.targetValue}
                                    </span>
                                  ) : null}
                                </div>
                                {w.description ? (
                                  <p className="text-muted-foreground mt-1">{w.description}</p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {w.addedByName ? (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="size-3.5 shrink-0" />
                                      Added by {w.addedByName}
                                    </span>
                                  ) : w.addedByUserId ? (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="size-3.5 shrink-0" />
                                      Academy staff
                                    </span>
                                  ) : null}
                                  {w.updatedAt ? (
                                    <span className="tabular-nums">
                                      Updated {w.updatedAt.split('T')[0]}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </Container>
  );
}
