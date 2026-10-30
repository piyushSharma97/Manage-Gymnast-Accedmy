import { Metadata } from 'next';
import { ListPage } from '@/features/lists/list-page';
import StudentsList from './components/students-list';

export const metadata: Metadata = {
  title: 'Students',
  description: 'Manage students.',
};

export default function StudentsPage() {
  return (
    <ListPage
      title="Students"
      desktopToolbarOnly
      crumbs={[{ label: 'Home', href: '/' }, { label: 'Students' }]}
    >
      <StudentsList />
    </ListPage>
  );
}
