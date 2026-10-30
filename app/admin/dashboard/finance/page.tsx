import { Fragment } from 'react';
import { Metadata } from 'next';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { Container } from '@/components/common/container';
import { PageNavbar } from '../page-navbar';
import BatchAmount from './components/batchamount';
import BeginnerAmount from './components/beginneramount';
import DepositAmount from './components/depositamount';
import DepositCount from './components/depositcount';
import FinanceTimeCharts from './components/finance-time-charts';
import PaymentCycle from './components/paymentcycle';
import TeamAmount from './components/teamamount';

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
          <div className="grid gap-5 lg:gap-7.5 items-stretch">
            <FinanceTimeCharts />
          </div>
          <div className="grid grid-cols-4 gap-5 lg:gap-7.5 h-full items-stretch">
            <div className="lg:col-span-4">
              <DepositCount />
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-4">
              <DepositAmount />
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
              <TeamAmount />
            </div>
            <div className="lg:col-span-2">
              <BeginnerAmount />
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-5 lg:gap-7.5 items-stretch">
            <div className="lg:col-span-2">
              <BatchAmount />
            </div>
            <div className="lg:col-span-2">
              <PaymentCycle />
            </div>
          </div>
        </div>
      </Container>
    </Fragment>
  );
}
