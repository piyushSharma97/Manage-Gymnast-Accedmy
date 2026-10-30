import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { getServerSession } from "next-auth";
export const metadata: Metadata = {
  title: 'Unauthorized Access',
  description: 'You do not have permission to access this resource.',
};

export default  async function UnauthorizedPage() {
  const serverSession        =await getServerSession();
  console.log('serverSession in unauthorized page:',serverSession);
  return (
    <Container>
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <div className="mx-auto max-w-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              403
            </h1>
            <h2 className="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
              Unauthorized Access
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              You do not have permission to access this resource. Please contact your administrator if you believe this is an error.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/">
                Go Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/signin">
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
}
