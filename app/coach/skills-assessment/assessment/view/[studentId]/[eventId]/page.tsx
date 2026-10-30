'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { ArrowLeft } from 'lucide-react';
import { AssessmentResultContent } from '@/app/admin/skills-assessment/assessment/components/assessment-results';

export default function CoachViewResultPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId != null ? String(params.studentId) : '';
  const eventId = params?.eventId != null ? String(params.eventId) : '';
  const studentName = searchParams?.get('studentName') || 'Student';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assessment-result', studentId, eventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.skillsAssessment.assessment.result, `studentId=${encodeURIComponent(studentId)}&eventId=${encodeURIComponent(eventId)}`)
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Failed to fetch assessment result');
      }
      return response.json();
    },
    enabled: Boolean(studentId && eventId),
  });

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>Assessment Result - {decodeURIComponent(studentName)}</ToolbarTitle>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/coach">Coach</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/coach/skills-assessment/assessment">
                    Assessment
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>View Result</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </ToolbarHeading>
        </Toolbar>
      </Container>
      <Container>
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/coach/skills-assessment/assessment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assessment
            </Link>
          </Button>
        </div>
        {!studentId || !eventId ? (
          <p className="text-muted-foreground">Missing student or event in the URL.</p>
        ) : (
          <AssessmentResultContent
            studentName={decodeURIComponent(studentName)}
            results={Array.isArray(data?.data) ? data.data : null}
            comments={data?.comments ?? null}
            isLoading={isLoading}
            studentHeight={data?.studentHeight ?? null}
            studentWeight={data?.studentWeight ?? null}
            eventName={data?.eventName ?? null}
            levelName={data?.levelName ?? null}
          />
        )}
        {isError && (
          <p className="mt-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load result'}
          </p>
        )}
      </Container>
    </>
  );
}
