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
import { AssessmentPastResultsContent } from '@/app/admin/skills-assessment/assessment/components/assessment-past-results';

export default function CoachPastResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId as string;
  const studentName = searchParams?.get('studentName') || 'Student';

  const { data, isLoading } = useQuery({
    queryKey: ['assessment-past-results', studentId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.skillsAssessment.assessment.pastResults, `studentId=${studentId}&limit=4`)
      );
      if (!response.ok) throw new Error('Failed to fetch past results');
      return response.json();
    },
    enabled: !!studentId,
  });

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>Past Performance</ToolbarTitle>
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
                  <BreadcrumbPage>Past Performance</BreadcrumbPage>
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
        <AssessmentPastResultsContent
          studentName={decodeURIComponent(studentName)}
          events={data?.data ?? null}
          isLoading={isLoading}
        />
      </Container>
    </>
  );
}
