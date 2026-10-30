'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoaderCircleIcon } from 'lucide-react';
import { RecaptchaPopover } from '@/components/common/recaptcha-popover';
import { getSigninSchema, SigninSchemaType } from '../forms/signin-schema';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already used with another sign-in method. Use the same method you used to sign up.',
  OAuthCallback:
    'Something went wrong during sign in. Please try again.',
  OAuthCreateAccount:
    'Could not create account. Please try again.',
  Callback:
    'Authentication failed. Please try again.',
  Default: 'An error occurred during sign in. Please try again.',
};

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecaptcha, setShowRecaptcha] = useState(false);

  // Handle OAuth errors from URL (e.g. /signin?error=OAuthAccountNotLinked)
  useEffect(() => {
    const urlError = searchParams?.get('error');
    const errorDescription = searchParams?.get('error_description');
    if (urlError) {
      setError(
        errorDescription ||
          OAUTH_ERROR_MESSAGES[urlError] ||
          OAUTH_ERROR_MESSAGES.Default,
      );
      // Clear URL params
      router.replace('/signin', { scroll: false });
    }
  }, [searchParams, router]);

  const form = useForm<SigninSchemaType>({
    resolver: zodResolver(getSigninSchema()),
    defaultValues: {
      email: 'demo@example.com',
      password: 'demo123',
      rememberMe: false,
    },
  });

  const handleFormAttempt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valid = await form.trigger();
    if (!valid) return;
    setShowRecaptcha(true);
  };

  async function onSubmitWithCaptcha(values: SigninSchemaType, token: string) {
    setIsProcessing(true);
    setError(null);

    try {
      const callbackUrl = '/';

      const result = await signIn('credentials', {
        redirect: false,
        callbackUrl,
        email: values.email,
        password: values.password,
        rememberMe: String(values.rememberMe),
        recaptchaToken: token,
      });

      if (result?.error) {
        const errMsg = result.error;
        try {
          const errorData =
            typeof errMsg === 'string' && errMsg.trim().startsWith('{')
              ? JSON.parse(errMsg)
              : { message: errMsg };
          setError(errorData.message ?? String(errMsg));
        } catch {
          setError(typeof errMsg === 'string' ? errMsg : 'Authentication failed.');
        }
        return;
      }

      if (!result?.ok) {
        setError('Authentication failed.');
        return;
      }

      // Full navigation so the session cookie from the sign-in response is always
      // sent on the next request. Client router.push + useSession() can race and
      // leave the protected layout on "unauthenticated" → bounce to /signin.
      const target = result.url
        ? new URL(result.url, window.location.origin).href
        : new URL(callbackUrl, window.location.origin).href;
      window.location.assign(target);
    } catch (err) {
      console.error('Signin error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const handleVerifiedSubmit = async (token: string) => {
    setShowRecaptcha(false);
    const values = form.getValues();
    await onSubmitWithCaptcha(values, token);
  };

  return (
    <Form {...form}>
      <form
        method="post"
        onSubmit={handleFormAttempt}
        className="block w-full space-y-5"
      >
        <div className="space-y-1.5 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Sign in to Connect My Gym
          </h1>
        </div>      

        {error && (
          <Alert variant="destructive">
            <AlertIcon>
              <AlertCircle />
            </AlertIcon>
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center gap-2.5">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/reset-password"
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  placeholder="Your password"
                  type={passwordVisible ? 'text' : 'password'} // Toggle input type
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={() => setPasswordVisible(!passwordVisible)} // Toggle visibility
                  className="absolute end-0 top-1/2 -translate-y-1/2 h-7 w-7 me-1.5 bg-transparent!"
                  aria-label={
                    passwordVisible ? 'Hide password' : 'Show password'
                  }
                >
                  {passwordVisible ? (
                    <EyeOff className="text-muted-foreground" />
                  ) : (
                    <Eye className="text-muted-foreground" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <>
                <Checkbox
                  id="remember-me"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm leading-none text-muted-foreground"
                >
                  Remember me
                </label>
              </>
            )}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <RecaptchaPopover
            open={showRecaptcha}
            onOpenChange={(open) => {
              if (!open) setShowRecaptcha(false);
            }}
            onVerify={handleVerifiedSubmit}
            verifyButtonText="Verify & Sign in"
            trigger={
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                Continue
              </Button>
            }
          />
        </div>
      </form>
    </Form>
  );
}
