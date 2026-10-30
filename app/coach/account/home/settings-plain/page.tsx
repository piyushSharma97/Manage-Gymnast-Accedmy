'use client';

import { Fragment } from 'react';
import { AccountSettingsPlainContent } from '@/app/admin/account/home/settings-plain/content';
import { Container } from '@/components/common/container';
import {
  Toolbar,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from '@/partials/common/toolbar';

export default function CoachAccountSettingsPlainPage() {
  return (
    <Fragment>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle text="My profile" />
            <ToolbarDescription>
              Update your photo, profile details, and password.
            </ToolbarDescription>
          </ToolbarHeading>
        </Toolbar>
      </Container>
      <Container>
        <AccountSettingsPlainContent />
      </Container>
    </Fragment>
  );
}
