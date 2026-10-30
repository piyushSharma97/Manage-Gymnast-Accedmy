import type { Metadata } from 'next';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Registration successful',
};

export default function ExternalRegisterSuccessPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle>Registration successful</CardTitle>
        <CardDescription>
          Your payment was received and your event registration is confirmed. Check your email for details.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
