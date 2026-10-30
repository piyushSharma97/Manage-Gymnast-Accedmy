'use client';

import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Activity } from 'lucide-react';
import Link from 'next/link';

type FitnessSkill = { id: number; name: string; level: string; description: string | null; orderSequence: number };

type CategoryAvg = { categoryName: string; average: number; count: number };
type FitnessAssessmentRow = {
  id: number;
  skillName: string;
  categoryName: string;
  achievedValue: string;
  unitOfMeasurement: string | null;
  remark: string | null;
};
type FitnessAssessmentEvent = {
  eventId: number;
  eventName: string | null;
  eventDate: string;
  average: number | null;
  categoryAverages: CategoryAvg[];
  rows: FitnessAssessmentRow[];
};

export default function ParentTrackerFitnessPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-tracker-fitness', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.tracker.fitness, `studentId=${studentId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: isReady && !!studentId,
  });

  const {
    data: assessmentData,
    isLoading: assessmentLoading,
    error: assessmentError,
  } = useQuery({
    queryKey: ['parent-tracker-fitness-assessment', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.tracker.fitnessAssessment, `studentId=${studentId}&limit=20`),
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
          <p className="text-muted-foreground mb-4">Select a child to view fitness curriculum.</p>
          <Link href="/parent/children" className="text-primary font-medium hover:underline">
            Select child &rarr;
          </Link>
        </div>
      </Container>
    );
  }

  if (isLoading || assessmentLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && assessmentError) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">Could not load fitness.</p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">Back</Link>
        </div>
      </Container>
    );
  }

  const skills = (data?.skills ?? []) as FitnessSkill[];
  const levels = (data?.levels ?? []) as string[];
  const skillsByLevel = (data?.skillsByLevel ?? {}) as Record<string, FitnessSkill[]>;

  const assessmentEvents = (assessmentData?.events ?? []) as FitnessAssessmentEvent[];
  const overallAverage = assessmentData?.overallAverage as number | null | undefined;
  const overallRowCount = (assessmentData?.overallRowCount ?? 0) as number;

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">Fitness</h1>
      </div>

      {assessmentError ? (
        <Card className="mb-6 border-destructive/50">
          <CardContent className="py-4 text-sm text-destructive">
            Could not load fitness assessment results. Curriculum below may still be available.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Fitness assessment results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Averages use numeric values from each measurement (same approach as academy reports).
              </p>
            </CardHeader>
            <CardContent>
              {overallRowCount > 0 && overallAverage != null ? (
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 mb-6">
                  <p className="text-sm text-muted-foreground">Overall average (all assessments shown)</p>
                  <p className="text-2xl font-semibold tabular-nums">{overallAverage}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Across {overallRowCount} measurement{overallRowCount === 1 ? '' : 's'}
                  </p>
                </div>
              ) : null}
              {assessmentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No fitness assessment results yet.</p>
              ) : (
                <div className="space-y-6">
                  {assessmentEvents.map((ev) => (
                    <div
                      key={`${ev.eventId}-${ev.eventDate}`}
                      className="rounded-lg border border-border overflow-hidden"
                    >
                      <div className="bg-muted/50 px-4 py-3 border-b border-border">
                        <p className="font-medium">
                          {ev.eventName ?? 'Fitness assessment'}
                          <span className="text-muted-foreground font-normal"> · {ev.eventDate}</span>
                        </p>
                        {ev.average != null ? (
                          <p className="text-sm text-muted-foreground mt-1">
                            Event average:{' '}
                            <span className="font-semibold text-foreground tabular-nums">{ev.average}</span>
                          </p>
                        ) : null}
                        {ev.categoryAverages.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {ev.categoryAverages.map((c) => (
                              <span
                                key={c.categoryName}
                                className="inline-flex items-center rounded-md bg-background border border-border px-2 py-1 text-xs"
                              >
                                <span className="text-muted-foreground mr-1">{c.categoryName}:</span>
                                <span className="font-medium tabular-nums">{c.average}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-background">
                              <th className="text-left p-3 font-medium">Skill</th>
                              <th className="text-left p-3 font-medium">Category</th>
                              <th className="text-left p-3 font-medium">Result</th>
                              <th className="text-left p-3 font-medium hidden sm:table-cell">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ev.rows.map((r) => (
                              <tr key={r.id} className="border-b border-border/50">
                                <td className="p-3 align-top">{r.skillName}</td>
                                <td className="p-3 align-top text-muted-foreground">{r.categoryName}</td>
                                <td className="p-3 align-top font-medium tabular-nums">
                                  {r.achievedValue}
                                  {r.unitOfMeasurement ? (
                                    <span className="text-muted-foreground font-normal text-xs ml-1">
                                      {r.unitOfMeasurement}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="p-3 align-top text-muted-foreground hidden sm:table-cell">
                                  {r.remark ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fitness curriculum</CardTitle>
          <p className="text-sm text-muted-foreground">
            Skills and activities tracked by the academy for your child&apos;s level.
          </p>
        </CardHeader>
      </Card>
      {skills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No fitness skills defined yet for this academy.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {levels.map((level) => {
            const levelSkills = skillsByLevel[level] ?? [];
            if (levelSkills.length === 0) return null;
            return (
              <Card key={level}>
                <CardHeader>
                  <CardTitle className="text-base">Level {level}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {levelSkills.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-start gap-3 rounded-md border border-border/50 p-3"
                      >
                        <span className="font-medium shrink-0">{s.name}</span>
                        {s.description && (
                          <span className="text-sm text-muted-foreground">{s.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
