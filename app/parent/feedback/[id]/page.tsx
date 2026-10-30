'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'sonner';

type Reply = {
  id: string;
  senderUserId: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

type Thread = {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
  guardian: { firstName: string; lastName: string | null; email: string | null };
  replies: Reply[];
};

export default function ParentFeedbackThreadPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['feedback-thread', id],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.byId(id));
      if (!res.ok) throw new Error('Failed to load thread');
      const json = await res.json();
      return json.data as Thread;
    },
    enabled: !!id,
  });

  // Mark this thread's notifications as read when viewing
  useEffect(() => {
    if (!id || !data) return;
    apiFetch(API_PATHS.feedback.notifications.read, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageIds: [Number(id)] }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications-count'] });
    });
  }, [id, data, queryClient]);

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.reply(id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.message ?? 'Failed to send reply');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Reply sent.');
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['feedback-thread', id] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications-count'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    replyMutation.mutate();
  };

  if (!id) {
    return (
      <div className="p-6">
        <Link href="/parent/feedback" className="text-primary hover:underline">
          ← Back to feedback
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const thread = data as Thread;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <Link
        href="/parent/feedback"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Back to feedback
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{thread.subject || 'No subject'}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(thread.createdAt).toLocaleString()} · You
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="whitespace-pre-wrap text-sm">{thread.body}</p>

          {thread.replies.map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                r.senderRole === 'parent'
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-muted/30'
              }`}
            >
              <p className="text-xs font-medium text-muted-foreground capitalize mb-1">
                {r.senderRole} · {new Date(r.createdAt).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap text-sm">{r.body}</p>
            </div>
          ))}

          <form onSubmit={handleReply} className="pt-4 border-t border-border">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="mb-2"
            />
            <Button type="submit" disabled={replyMutation.isPending || !replyText.trim()}>
              {replyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="ml-2">Send reply</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
