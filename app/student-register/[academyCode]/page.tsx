import type { Metadata } from 'next';
import { ExternalStudentRegisterForm } from './external-student-register-form';

type Props = {
  params: Promise<{ academyCode: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Student registration',
  };
}

export default async function StudentRegisterPage({ params }: Props) {
  const { academyCode: raw } = await params;
  const academyCode = decodeURIComponent(raw);

  return <ExternalStudentRegisterForm academyCode={academyCode} />;
}
