import { Fragment } from 'react';
import { Metadata } from 'next';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { Container } from '@/components/common/container';
import { PageNavbar } from '../page-navbar';
import ActiveGymnastChart from './components/activegymnast';
import SkillsMonth from './components/skillmonth';
import SkillsDay from './components/skillsday';

export const metadata: Metadata = {
  title: 'Users',
  description: 'Manage users.',
};

export default async function Page() {
  return (
    <Fragment>
      <PageNavbar />
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Attendance Metrics"
            description="Attendance Distribution and analytics"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5 ">
          <div className="grid grid-cols-4 gap-5 lg:gap-7.5 h-full items-stretch">
            <div className="lg:col-span-4">
              <SkillsDay />
            </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
              <ActiveGymnastChart />
            </div>
            <div className="lg:col-span-2">
              <SkillsMonth />
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
