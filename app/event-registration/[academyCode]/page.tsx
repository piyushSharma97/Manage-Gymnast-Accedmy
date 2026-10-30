import type { Metadata } from 'next';
import { ExternalRegistrationForm } from './external-registration-form';

type Props = {
  params: Promise<{ academyCode: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Event registration',
  };
}

export default async function ExternalEventRegisterPage({ params }: Props) {
  const { academyCode: raw } = await params;
  const academyCode = decodeURIComponent(raw);

  return <ExternalRegistrationForm academyCode={academyCode} />;
}
