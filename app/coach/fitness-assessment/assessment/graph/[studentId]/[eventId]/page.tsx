'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type GraphDataItem = {
  apparatus: string;
  highMark: number;
  lowMark: number;
  studentMark: number;
};

export default function CoachFitnessAssessmentGraphPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId as string;
  const eventId = params?.eventId as string;
  const studentName = searchParams?.get('studentName') || 'Student';

  const { data, isLoading, error } = useQuery({
    queryKey: ['fitness-assessment-graph-data', studentId, eventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(
          API_PATHS.fitnessAssessment.assessment.graphData,
          `studentId=${studentId}&eventId=${eventId}`
        )
      );
      if (!response.ok) throw new Error('Failed to fetch graph data');
      return response.json();
    },
    enabled: !!studentId && !!eventId,
  });

  const graphData = (data?.data ?? []) as GraphDataItem[];

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load graph data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href="/coach" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href="/coach/fitness-assessment/assessment" className="hover:text-primary">
          Fitness Assessment
        </Link>
        {' / '}
        <span>Fitness progression</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fitness progression (by level)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Event: {data?.eventName ?? '—'} | Student: {studentName}
          </p>
        </CardHeader>
        <CardContent>
          {!graphData.length ? (
            <div className="text-center py-12 text-muted-foreground">
              No graph data available for this student
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-white">
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="apparatus" angle={-90} textAnchor="end" height={120} interval={0} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="lowMark" stroke="#3b82f6" name="Lowest" />
                  <Line type="monotone" dataKey="highMark" stroke="#f97316" name="Highest" />
                  <Line type="monotone" dataKey="studentMark" stroke="#22c55e" name="Your Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
