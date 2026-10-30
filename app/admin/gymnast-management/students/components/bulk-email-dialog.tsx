'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface BulkEmailDialogProps {
  open: boolean;
  closeDialog: () => void;
  /** Query key to invalidate on success (e.g. ['admin-students'] or ['manager-students']) */
  invalidateKey?: string[];
  onSuccess?: () => void;
}

/**
 * Bulk email dialog: send one message to all students' parents (no selection).
 * Uses academy SMTP from DB when configured, else owner SMTP from env.
 */
const BulkEmailDialog = ({
  open,
  closeDialog,
  invalidateKey = ['admin-students'],
  onSuccess,
}: BulkEmailDialogProps) => {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.student.sendEmail, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          description: description.trim() || undefined,
          // No studentIds = bulk send to all students' parents
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message || 'Failed to send email');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data?.message ?? 'Emails sent');
      closeDialog();
      setSubject('');
      setDescription('');
      if (invalidateKey.length) {
        queryClient.invalidateQueries({ queryKey: invalidateKey });
      }
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Bulk email to parents</DialogTitle>
            <DialogDescription>
              Send one message to all students&apos; parents. Emails go to each student&apos;s primary guardian (or
              student email if no guardian). Sent using your academy&apos;s SMTP when configured, otherwise platform
              SMTP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-subject">Subject (optional)</Label>
              <Input
                id="bulk-subject"
                placeholder="Message from your academy"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-description">Message (optional)</Label>
              <Textarea
                id="bulk-description"
                placeholder="Enter your message. Each parent will receive this with a greeting."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
              Send email
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkEmailDialog;
