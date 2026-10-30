import { Fragment } from 'react';
import { Metadata } from 'next';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { Container } from '@/components/common/container';
import { PageNavbar } from '../page-navbar';
import AgewiseChart from './components/agewise-chart';
import AgewiseFemale from './components/agewise-female';
import AgewiseMale from './components/agewise-male';
import GymnastChart from './components/gymnast-chart';
import RecreationalChart from './components/recreational';

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
            title="Student Demographics"
            description="Understand Age Distribution & Gender Breakdown"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-1">
              <RecreationalChart />
            </div>
            <div className="lg:col-span-2">
              <GymnastChart />
            </div>
          </div>
         
          <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-1">
              <AgewiseChart />
            </div>
            <div className="lg:col-span-1">
              <AgewiseFemale />
            </div>
            <div className="lg:col-span-1">
              <AgewiseMale />
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
