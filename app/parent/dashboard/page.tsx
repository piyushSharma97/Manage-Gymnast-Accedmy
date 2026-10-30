'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { getRechartsTheme, getSkillBarFill } from '@/lib/chart-theme';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Loader2, User, Calendar, Award, TrendingUp, IdCard } from 'lucide-react';
import Link from 'next/link';

type DashboardData = {
  name: string;
  level: string;
  registrationNo: string;
  dateOfBirth: string | null;
  gender: string;
  joinDate: string | null;
  classesCompleted: number;
  averageScore: number | null;
  enrollments: Array<{ courseName?: string; programName?: string; status: string }>;
  progress: {
    latestScores: Array<{
      skillName: string;
      apparatusName: string;
      score: number;
      level: string | null;
      eventdate: string;
    }>;
    recentComments: Array<{ comment: string | null; commentdate: string }>;
  };
  skills: Array<{
    skillId: number;
    name: string;
    apparatus: string;
    score: number;
    level: string | null;
    color: string | null;
  }>;
};

function SkillsOverviewChart({ skills }: { skills: DashboardData['skills'] }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => getRechartsTheme(mode), [mode]);

  const chartData = useMemo(
    () =>
      skills.map((s, i) => ({
        name: s.name.length > 14 ? `${s.name.slice(0, 14)}…` : s.name,
        fullName: s.name,
        score: s.score,
        apparatus: s.apparatus,
        fill: getSkillBarFill(s.color, i),
      })),
    [skills],
  );

  if (chartData.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No skills data yet. Assessments will appear here once recorded.
      </p>
    );
  }

  return (
    <div className="h-[340px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 16, right: 8, left: 4, bottom: 56 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.gridStroke}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: theme.tickFill }}
            tickLine={false}
            axisLine={{ stroke: theme.axisLine }}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 11, fill: theme.tickFill }}
            tickLine={false}
            axisLine={{ stroke: theme.axisLine }}
            allowDecimals={false}
            domain={[0, (max: number) => Math.max(5, max + 1)]}
            width={36}
          />
          <Tooltip
            cursor={{ fill: theme.cursorFill }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof chartData)[0];
              return (
                <div
                  className="rounded-lg px-3 py-2 text-sm shadow-lg border"
                  style={{
                    backgroundColor: theme.tooltipBg,
                    borderColor: theme.tooltipBorder,
                    color: theme.tooltipFg,
                  }}
                >
                  <p className="font-semibold">{d.fullName}</p>
                  <p style={{ color: theme.tooltipMuted }}>{d.apparatus}</p>
                  <p className="mt-1 font-medium tabular-nums">Score: {d.score}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} name="Score" maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${entry.fullName}-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ParentDashboardPage() {
  const { selectedStudentId: studentId, isReady } = useParentSelectedStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-dashboard', studentId],
    queryFn: async () => {
      const res = await apiFetch(
        withParams(API_PATHS.parent.dashboard, `studentId=${studentId}`),
      );
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json() as Promise<DashboardData>;
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
          <p className="text-muted-foreground mb-4">
            Select a child from the header or choose one below.
          </p>
          <Link
            href="/parent/children"
            className="text-primary font-medium hover:underline"
          >
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

  if (error || !data) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-destructive">
            Could not load dashboard. Please try again.
          </p>
          <Link href="/parent/children" className="text-primary mt-2 inline-block">
            Back to select child
          </Link>
        </div>
      </Container>
    );
  }

  const enrollmentLabel = (e: DashboardData['enrollments'][0]) =>
    e.courseName || e.programName || 'Program';

  return (
    <Container width="fluid" className="py-6 sm:py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">
            {data.registrationNo}
            {data.level !== '—' ? ` · ${data.level}` : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <IdCard className="size-4 text-primary" />
            Student details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Registration</dt>
              <dd className="font-medium mt-0.5">{data.registrationNo || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Level</dt>
              <dd className="font-medium mt-0.5">{data.level}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date of birth</dt>
              <dd className="font-medium mt-0.5">{data.dateOfBirth ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="font-medium mt-0.5">
                {data.gender ? String(data.gender).replace(/_/g, ' ') : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium mt-0.5">{data.joinDate ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Level
            </CardTitle>
            <Award className="size-4 text-primary/80" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.level}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Classes completed
            </CardTitle>
            <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.classesCompleted}
            </p>
            <p className="text-xs text-muted-foreground">Attendance records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average score
            </CardTitle>
            <TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.averageScore != null ? data.averageScore : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.skills.length > 0
                ? `Across ${data.skills.length} skill${data.skills.length === 1 ? '' : 's'} (latest)`
                : 'No assessed skills yet'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enrolled
            </CardTitle>
            <User className="size-4 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {data.enrollments.length}
            </p>
            <p className="text-xs text-muted-foreground">Active enrollments</p>
          </CardContent>
        </Card>
      </div>

      {data.enrollments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programs & courses</CardTitle>
            <p className="text-sm text-muted-foreground">
              Current enrollments for your child
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {data.enrollments.map((e, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{enrollmentLabel(e)}</span>
                  <span className="text-muted-foreground capitalize">{e.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Progress & performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest assessment scores and coach comments
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.progress.latestScores.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="text-left p-3 font-medium">Skill</th>
                    <th className="text-left p-3 font-medium">Apparatus</th>
                    <th className="text-left p-3 font-medium">Score</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.progress.latestScores.slice(0, 10).map((s, i) => (
                    <tr key={`${s.skillName}-${s.eventdate}-${i}`} className="border-b border-border/50">
                      <td className="p-3">{s.skillName}</td>
                      <td className="p-3 text-muted-foreground">
                        {s.apparatusName ?? '—'}
                      </td>
                      <td className="p-3 font-medium tabular-nums">{s.score}</td>
                      <td className="p-3 text-muted-foreground tabular-nums">
                        {s.eventdate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No assessment scores yet.</p>
          )}
          {data.progress.recentComments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Recent comments</h4>
              <ul className="space-y-2 text-sm">
                {data.progress.recentComments.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border/80 bg-muted/20 px-3 py-2"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      {c.commentdate}
                    </span>
                    <p className="text-foreground mt-1">{c.comment ?? '—'}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Latest score per skill — colors match your academy&apos;s skill tags when set
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <SkillsOverviewChart skills={data.skills} />
        </CardContent>
      </Card>
    </Container>
  );
}
