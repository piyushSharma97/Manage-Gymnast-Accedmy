import { Metadata } from 'next';
import { Container } from '@/components/common/container';
import { Toolbar, ToolbarHeading, ToolbarTitle } from '@/components/common/toolbar';
import RegistrationList from './components/registration-list';

export const metadata: Metadata = {
  title: 'Event Registrations',
  description: 'Manage student registrations for events.',
};

export default function Page() {
  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>Event Registrations</ToolbarTitle>
          </ToolbarHeading>
        </Toolbar>
      </Container>
      <Container>
        <RegistrationList />
      </Container>
    </>
  );
}