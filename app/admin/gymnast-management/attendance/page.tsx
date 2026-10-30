import { Metadata } from 'next';
import { ListPage } from '@/features/lists/list-page';
import AttendanceList from './components/attendance-list';

export const metadata: Metadata = {
  title: 'Attendance',
  description: 'Mark student attendance.',
};

export default function AttendancePage() {
  return (
    <ListPage
      title="Attendance"
      desktopToolbarOnly
      crumbs={[{ label: 'Home', href: '/' }, { label: 'Attendance' }]}
    >
      <AttendanceList />
    </ListPage>
  );
}
