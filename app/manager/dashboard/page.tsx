'use client';

import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/layouts/demo1/components/toolbar';
import { ManagerDashboard } from '@/components/manager/manager-dashboard';
import { AtRiskPanel } from '@/features/ai/at-risk-panel';

export default function Page() {
  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading
            title="Dashboard"
            description="Overview of your location"
          />
          <ToolbarActions></ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <div className="grid gap-5">
          <AtRiskPanel />
          <ManagerDashboard />
        </div>
      </Container>
    </>
  );
}

