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

export default function FitnessAssessmentGraphPage() {
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
        <Link href="/admin" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href="/admin/fitness-assessment/assessment" className="hover:text-primary">
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
            <div className="space-y-6">
              <div className="border rounded-lg p-6 bg-white">
                <h3 className="text-lg font-semibold mb-6">
                  Fitness progression range in your age category
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart
                    data={graphData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="apparatus"
                      angle={-90}
                      textAnchor="end"
                      height={120}
                      interval={0}
                      tick={{ fontSize: 12, fill: '#374151' }}
                    />
                    <YAxis
                      label={{
                        value: 'Weighted Score',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 14, fill: '#374151' },
                      }}
                      domain={[0, 100]}
                      ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                      tick={{ fontSize: 12, fill: '#374151' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '8px',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="square" />
                    <Line
                      type="monotone"
                      dataKey="lowMark"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Lowest"
                      dot={{ r: 5, fill: '#3b82f6' }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="highMark"
                      stroke="#f97316"
                      strokeWidth={3}
                      name="Highest"
                      dot={{ r: 5, fill: '#f97316' }}
                      activeDot={{ r: 7 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="studentMark"
                      stroke="#22c55e"
                      strokeWidth={3}
                      name="Your Score"
                      dot={{ r: 5, fill: '#22c55e' }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-3 text-left font-semibold">Level</th>
                      <th className="px-4 py-3 text-right font-semibold">Lowest</th>
                      <th className="px-4 py-3 text-right font-semibold">Highest</th>
                      <th className="px-4 py-3 text-right font-semibold">Your Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphData.map((item, index) => (
                      <tr key={index} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{item.apparatus}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                            {item.lowMark}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-orange-500" />
                            {item.highMark}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                            {item.studentMark}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
