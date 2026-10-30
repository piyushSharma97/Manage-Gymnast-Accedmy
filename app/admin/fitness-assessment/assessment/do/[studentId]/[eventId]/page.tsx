import { Metadata } from 'next';
import { DoAssessmentPage } from '@/features/assessments/do-assessment-page';

export const metadata: Metadata = {
  title: 'Do Fitness Assessment',
  description: 'Complete fitness assessment for a student.',
};

type PageProps = {
  params: Promise<{ studentId: string; eventId: string }>;
  searchParams: Promise<{ studentName?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { studentId, eventId } = await params;
  const { studentName = 'Student' } = await searchParams;
  return (
    <DoAssessmentPage
      role="admin"
      kind="fitness"
      studentId={studentId}
      eventId={eventId}
      studentName={studentName}
    />
  );
}
