'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Container } from '@/components/common/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

type Thread = {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
  guardian: { firstName: string; lastName: string | null; email: string | null };
  _count: { replies: number };
};

export default function ParentFeedbackPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['feedback-list'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.list);
      if (!res.ok) throw new Error('Failed to load feedback');
      const json = await res.json();
      return (json.data ?? []) as Thread[];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.list, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim() || undefined, message: message.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message ?? 'Failed to send');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Feedback sent. Admin/Manager/Coach will be notified and can reply here.');
      setSubject('');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications-count'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter your message');
      return;
    }
    sendMutation.mutate();
  };

  const threads = (data ?? []) as Thread[];

  return (
    <Container width="fluid" className="py-6 sm:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Send Feedback</h1>
        <p className="text-muted-foreground mt-1">
          Send a message to your academy admin, manager, or coach. They will see it in their notifications and can reply here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            New message
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your message will be visible to admin, manager, and coach for your academy.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question about schedule"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="mt-1"
                required
              />
            </div>
            <Button type="submit" disabled={sendMutation.isPending || !message.trim()}>
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="ml-2">Send feedback</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your messages</CardTitle>
          <p className="text-sm text-muted-foreground">
            View replies from admin, manager, or coach. You will also get a notification when they reply.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              You have not sent any feedback yet. Use the form above to send a message.
            </p>
          ) : (
            <ul className="space-y-3">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/parent/feedback/${t.id}`}
                    className="block rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {t.subject || 'No subject'}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                          {t.body}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(t.createdAt).toLocaleString()} · {t._count.replies} reply
                          {t._count.replies !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-primary text-sm font-medium shrink-0">View →</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
