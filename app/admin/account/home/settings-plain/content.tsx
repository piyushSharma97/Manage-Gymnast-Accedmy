'use client';

import { BasicSettings, Password } from './components';

export function AccountSettingsPlainContent() {
  return (
    <div className="mx-auto grid max-w-xl gap-5 lg:gap-7.5">
      <BasicSettings title="Profile" />
      <Password />
    </div>
  );
}
