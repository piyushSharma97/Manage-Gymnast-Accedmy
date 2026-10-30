'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageSquare } from 'lucide-react';

type NotificationItem = {
  id: string;
  readAt: string | null;
  createdAt: string;
  rootId: string;
  subject: string | null;
  body: string;
  senderRole: string;
  guardianName: string;
};

export function FeedbackNotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const roleSlug = session?.user?.roleSlug as string | undefined;
  const isParent = roleSlug === 'parent' || roleSlug === 'guardian';
  const feedbackPath = isParent
    ? '/parent/feedback'
    : roleSlug === 'admin'
      ? '/admin/feedback'
      : roleSlug === 'manager'
        ? '/manager/feedback'
        : roleSlug === 'coach'
          ? '/coach/feedback'
          : '/admin/feedback';

  const { data: countData } = useQuery({
    queryKey: ['feedback-notifications-count'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.notifications.count);
      if (!res.ok) return { count: 0 };
      const json = await res.json();
      return { count: json.count ?? 0 };
    },
  });

  const { data: listData } = useQuery({
    queryKey: ['feedback-notifications-list'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.notifications.list + '?limit=20');
      if (!res.ok) return { data: [] };
      const json = await res.json();
      return { data: (json.data ?? []) as NotificationItem[] };
    },
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.notifications.read, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to mark read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-notifications-list'] });
    },
  });

  const unreadCount = countData?.count ?? 0;
  const notifications = (listData?.data ?? []) as NotificationItem[];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-[420px] sm:max-w-none flex flex-col [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-5" />
            Feedback & messages
          </SheetTitle>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </SheetHeader>
        <SheetBody className="p-0 flex flex-col min-h-0">
          <ScrollArea className="flex-1 h-[calc(100vh-12rem)]">
            <FeedbackNotificationsList
              notifications={notifications}
              feedbackPath={feedbackPath}
              onOpen={() => {
                setOpen(false);
                queryClient.invalidateQueries({ queryKey: ['feedback-notifications-list'] });
                queryClient.invalidateQueries({ queryKey: ['feedback-notifications-count'] });
              }}
            />
          </ScrollArea>
          <div className="p-3 border-t border-border flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => markReadMutation.mutate()}
              disabled={unreadCount === 0 || markReadMutation.isPending}
            >
              Mark all as read
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href={feedbackPath}>View all</Link>
            </Button>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function FeedbackNotificationsList({
  notifications,
  feedbackPath,
  onOpen,
}: {
  notifications: NotificationItem[];
  feedbackPath: string;
  onOpen?: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No notifications. When a parent sends feedback or someone replies, it will show here.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {notifications.map((n) => (
        <li key={n.id}>
          <Link
            href={`${feedbackPath}/${n.rootId}`}
            onClick={onOpen}
            className={`block p-4 hover:bg-muted/50 transition-colors ${!n.readAt ? 'bg-primary/5' : ''}`}
          >
            <p className="font-medium text-sm truncate">
              {n.subject || 'New message'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {n.guardianName ? `From ${n.guardianName}: ` : ''}
              {n.body}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Badge count for bell - use with trigger that wraps the bell icon */
export function useFeedbackNotificationsCount(): number {
  const { data } = useQuery({
    queryKey: ['feedback-notifications-count'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.feedback.notifications.count);
      if (!res.ok) return { count: 0 };
      const json = await res.json();
      return { count: json.count ?? 0 };
    },
  });
  return data?.count ?? 0;
}
