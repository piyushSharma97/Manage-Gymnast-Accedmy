import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import AssessmentForm from '@/app/admin/skills-assessment/assessment/components/assessment-form';
import FitnessAssessmentForm from '@/app/admin/fitness-assessment/assessment/components/fitness-assessment-form';

export type AssessmentRole = 'admin' | 'manager' | 'coach';
export type AssessmentKind = 'skills' | 'fitness';

const ROLE_LABEL: Record<AssessmentRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  coach: 'Coach',
};

/**
 * One assessment screen for admin, manager, and coach.
 * The role route only passes who is signed in and which assessment it is.
 */
export function DoAssessmentPage({
  role,
  kind,
  studentId,
  eventId,
  studentName,
}: {
  role: AssessmentRole;
  kind: AssessmentKind;
  studentId: string;
  eventId: string;
  studentName: string;
}) {
  const section = kind === 'skills' ? 'skills-assessment' : 'fitness-assessment';
  const listHref = `/${role}/${section}/assessment`;
  const title = kind === 'skills' ? 'Do Assessment' : 'Do Fitness Assessment';
  const parsedEventId = parseInt(eventId, 10);

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>{title}</ToolbarTitle>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`/${role}`}>{ROLE_LABEL[role]}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={listHref}>Assessment</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </ToolbarHeading>
        </Toolbar>
      </Container>
      <Container>
        {kind === 'skills' ? (
          <AssessmentForm
            studentId={studentId}
            studentName={decodeURIComponent(studentName)}
            eventId={parsedEventId}
            asPage
            redirectPath={listHref}
          />
        ) : (
          <FitnessAssessmentForm
            studentId={studentId}
            studentName={decodeURIComponent(studentName)}
            eventId={parsedEventId}
            asPage
            redirectPath={listHref}
          />
        )}
      </Container>
    </>
  );
}
