import { Fragment } from 'react';
import { Metadata } from 'next';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { Container } from '@/components/common/container';
import { PageNavbar } from '../page-navbar';

import DaysofWeek from './components/daysofweek';
import ClassperWeek from './components/classperweek';
import KpiStatsItems from './components/kpi';

import BatchOpted from './components/batchopted';
import BatchWise from './components/batchwise';
import { AtRiskPanel } from '@/features/ai/at-risk-panel';

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
            title="Enrollment"
            description="Understand student progress & retention"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5 lg:gap-7.5">
          <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-1">
              <div className="grid grid-cols-2 gap-5 lg:gap-7.5 h-full items-stretch">
                <KpiStatsItems />
              </div>
            </div>
            <div className="lg:col-span-2">
              <DaysofWeek />
            </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            
            <div className="lg:col-span-2">
              <BatchWise />
            </div>
          </div>
          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
            <BatchOpted />
            </div>
            <div className="lg:col-span-2">
              <ClassperWeek />
            </div>
          </div>
          <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-3">
              <AtRiskPanel />
            </div>
          </div>
         
        </div>
      </Container>
    </Fragment>
  );
}
