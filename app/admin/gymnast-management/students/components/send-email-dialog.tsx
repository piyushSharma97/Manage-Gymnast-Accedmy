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

type StudentInfo = {
  id: string;
  registrationNo: string;
  firstName: string;
  lastName: string | null;
};

export interface SendEmailDialogProps {
  open: boolean;
  closeDialog: () => void;
  selectedStudents: StudentInfo[];
  onSuccess?: () => void;
}

const SendEmailDialog = ({
  open,
  closeDialog,
  selectedStudents,
  onSuccess,
}: SendEmailDialogProps) => {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const studentIds = selectedStudents.map((s) => s.id);
      const res = await apiFetch(API_PATHS.student.sendEmail, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds,
          subject: subject.trim() || undefined,
          description: description.trim() || undefined,
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
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
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

  const studentNames = selectedStudents
    .map((s) => `${s.firstName} ${s.lastName || ''}`.trim() || s.registrationNo)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send email to parents</DialogTitle>
            <DialogDescription>
              Emails will be sent to the parent of each selected student. Parent email addresses
              are not displayed for privacy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-muted-foreground text-sm">
                Selected students ({selectedStudents.length})
              </Label>
              <p className="mt-1 truncate text-sm" title={studentNames}>
                {studentNames || '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                placeholder={`Message from your academy`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Message (optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter your message. Each parent will receive this message with a greeting for their child."
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

export default SendEmailDialog;
