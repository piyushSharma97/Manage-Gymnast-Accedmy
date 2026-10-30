'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Password = () => {
  return (
    <Card className="pb-2.5">
      <CardHeader id="password_settings" className="scroll-mt-24">
        <CardTitle>Password</CardTitle>
        <CardDescription>
          For security, password resets use a link sent to your email. You can also change your password from the link in a reset email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" asChild>
          <Link href="/reset-password">
            <KeyRound className="size-4" />
            Send reset link
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export { Password };
