import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Payment incomplete',
};

const reasons: Record<string, string> = {
  invalid: 'This payment session was invalid. Please try registering again.',
  notfound: 'We could not find your registration.',
  tenant: 'Academy configuration is missing.',
  config: 'Payment could not be verified.',
  hash: 'Payment verification failed.',
  amount: 'The paid amount did not match.',
  payment: 'The payment did not complete successfully.',
  error: 'Something went wrong. Please try again or contact the academy.',
};

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function ExternalRegisterFailurePage({ searchParams }: Props) {
  const q = await searchParams;
  const reason = q.reason && reasons[q.reason] ? reasons[q.reason] : reasons.error;

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>Payment not completed</CardTitle>
        <CardDescription>{reason}</CardDescription>
      </CardHeader>
    </Card>
  );
}
