import { Metadata } from 'next';
import { ListPage } from '@/features/lists/list-page';
import InvoiceList from './components/invoice-list';

export const metadata: Metadata = {
  title: 'Invoices',
  description: 'Manage invoices.',
};

export default function InvoicePage() {
  return (
    <ListPage
      title="Invoices"
      crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Fees', href: '/admin/fees/invoice' },
        { label: 'Invoices' },
      ]}
    >
      <InvoiceList />
    </ListPage>
  );
}
