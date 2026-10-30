'use client';

import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Award } from 'lucide-react';
import Link from 'next/link';


type Score = { id: number; skillName: string; apparatusName: string; level: string | null; score: number; remark: string | null };
type EventResult = { eventId: number; eventDate: string; scores: Score[] };

export default function ParentTrackerSkillAssessmentPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-tracker-skill-assessment', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.tracker.skillAssessment, `studentId=${studentId}&limit=20`),
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
          <p className="text-muted-foreground mb-4">Select a child to view skill assessments.</p>
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
          <p className="text-destructive">Could not load skill assessments.</p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">Back</Link>
        </div>
      </Container>
    );
  }

  const events = (data?.data ?? []) as EventResult[];

  return (
    <Container width="fluid" className="py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Award className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">Skill assessment</h1>
      </div>
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No skill assessment results yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {events.map((ev) => (
            <Card key={`${ev.eventId}-${ev.eventDate}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assessment · {ev.eventDate}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-3 font-medium">Skill</th>
                        <th className="text-left p-3 font-medium">Apparatus</th>
                        <th className="text-left p-3 font-medium">Score</th>
                        <th className="text-left p-3 font-medium">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.scores.map((s) => (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="p-3">{s.skillName}</td>
                          <td className="p-3 text-muted-foreground">{s.apparatusName}</td>
                          <td className="p-3 font-medium">{s.score}</td>
                          <td className="p-3 text-muted-foreground">{s.level ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
