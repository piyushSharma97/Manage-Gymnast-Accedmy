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
import { FitnessAssessmentPastResultsContent } from '@/app/admin/fitness-assessment/assessment/components/fitness-assessment-past-results';

export default function ManagerFitnessAssessmentPastResultsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId as string;
  const studentName = searchParams?.get('studentName') || 'Student';

  const { data, isLoading } = useQuery({
    queryKey: ['fitness-assessment-past-results', studentId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(
          API_PATHS.fitnessAssessment.assessment.pastResults,
          `studentId=${studentId}&limit=4`
        )
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
            <ToolbarTitle>Past Fitness Performance</ToolbarTitle>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/manager">Manager</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/manager/fitness-assessment/assessment">
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
            <Link href="/manager/fitness-assessment/assessment">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assessment
            </Link>
          </Button>
        </div>
        <FitnessAssessmentPastResultsContent
          studentName={decodeURIComponent(studentName)}
          events={data?.data ?? null}
          isLoading={isLoading}
        />
      </Container>
    </>
  );
}
