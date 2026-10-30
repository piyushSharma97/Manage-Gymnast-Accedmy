'use client';

import { Container } from '@/components/common/container';
import { StaffFeedbackList } from './components/staff-feedback-list';

export default function AdminFeedbackPage() {
  return (
    <Container width="fluid" className="py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Parent feedback</h1>
        <p className="text-muted-foreground mt-1">
          View and reply to messages from parents.
        </p>
      </div>
      <StaffFeedbackList basePath="/admin" />
    </Container>
  );
}
