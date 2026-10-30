import { Metadata } from 'next';
import { ListPage } from '@/features/lists/list-page';
import PaymentList from './components/payment-list';

export const metadata: Metadata = {
  title: 'Payments',
  description: 'Manage payments.',
};

export default function PaymentsPage() {
  return (
    <ListPage
      title="Payments"
      crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Fees', href: '/manager/fees/payments' },
        { label: 'Payments' },
      ]}
    >
      <PaymentList />
    </ListPage>
  );
}
