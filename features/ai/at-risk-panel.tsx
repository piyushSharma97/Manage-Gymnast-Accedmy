'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AtRiskResponse = {
  students: { studentId: string; name: string; reasons: string[] }[];
  openTrials: { id: string; name: string; trialDate: string }[];
};

export function AtRiskPanel() {
  const query = useQuery({
    queryKey: ['ai-at-risk'],
    queryFn: async () => {
      const response = await apiFetch('/api/ai/at-risk');
      if (!response.ok) {
        throw new Error('Could not load at-risk students');
      }
      return (await response.json()) as AtRiskResponse;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>At-risk students</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Ranked from attendance, overdue invoices, and skills still marked learning. Nothing is emailed from this list.
        </p>
        {query.isLoading ? <p>Loading…</p> : null}
        {query.isError ? <p>Could not load this list.</p> : null}
        {query.data && query.data.students.length === 0 ? (
          <p>No active students match the at-risk rules right now.</p>
        ) : null}
        {query.data?.students.map((student) => (
          <div key={student.studentId} className="border-b border-border pb-3 last:border-0">
            <p className="font-medium">{student.name}</p>
            <ul className="mt-1 list-disc ps-4 text-muted-foreground">
              {student.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ))}
        {query.data && query.data.openTrials.length > 0 ? (
          <div>
            <p className="font-medium">Trials with no enrollment</p>
            <ul className="mt-1 list-disc ps-4 text-muted-foreground">
              {query.data.openTrials.map((trial) => (
                <li key={trial.id}>
                  {trial.name} · {new Date(trial.trialDate).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
