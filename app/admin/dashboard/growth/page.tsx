import { Fragment } from 'react';
import { Metadata } from 'next';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { Container } from '@/components/common/container';
import { PageNavbar } from '../page-navbar';
import ActiveStudents from './components/activestudents';
import Dropped from './components/dropped';
import NetGrowth from './components/netgrowth';
import Newtrial from './components/newtrial';

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
            title="Growth Metrics"
            description="Understand Month-over-month growth rate & retention"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
              <Newtrial />
            </div>
            <div className="lg:col-span-2">
              <Dropped />
            </div>
          </div>
        </div>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
              <NetGrowth />
            </div>
            <div className="lg:col-span-2">
              <ActiveStudents />
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
