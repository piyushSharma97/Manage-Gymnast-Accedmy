'use client';

import { useState, useEffect } from 'react';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CommentRecord = {
  id: number;
  eventid: number;
  tenantId: number;
  studentId: number;
  commentdate: string;
  comment: string | null;
};

export interface FitnessAssessmentCommentDialogProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  eventId: number;
  eventName?: string;
  eventDate?: string | Date | null;
  onSuccess?: () => void;
}

const FitnessAssessmentCommentDialog = ({
  open,
  onClose,
  studentId,
  studentName,
  eventId,
  eventName,
  eventDate,
  onSuccess,
}: FitnessAssessmentCommentDialogProps) => {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [overridePrevious, setOverridePrevious] = useState(false);

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['fitness-assessment-comments', studentId, eventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.fitnessAssessment.assessment.comments, `studentId=${studentId}&eventId=${eventId}`)
      );
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: open && !!studentId && !!eventId,
  });

  const comments: CommentRecord[] = commentsData?.data ?? [];
  const hasExistingComments = comments.length > 0;
  const latestComment = hasExistingComments ? comments[0] : null;

  useEffect(() => {
    if (!open) {
      setComment('');
      setOverridePrevious(false);
    } else if (latestComment?.comment) {
      setComment(latestComment.comment || '');
    } else {
      setComment('');
    }
  }, [open, latestComment]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        API_PATHS.fitnessAssessment.assessment.comments,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            eventId,
            comment: comment.trim() || null,
            override: overridePrevious,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to save comment');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>Comment saved successfully</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' }
      );
      queryClient.invalidateQueries({
        queryKey: ['fitness-assessment-comments', studentId, eventId],
      });
      queryClient.invalidateQueries({ queryKey: ['fitness-assessment'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' }
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fitness Assessment Comment - {studentName}</DialogTitle>
          {(eventName || eventDate) && (
            <p className="text-sm text-muted-foreground">
              {[eventName, eventDate ? format(new Date(eventDate), 'MMM d, yyyy') : null]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoaderCircleIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {hasExistingComments && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Previous comments</Label>
                  <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
                    {comments.map((c) => (
                      <div
                        key={c.id}
                        className="border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.commentdate), 'MMM d, yyyy')}
                        </p>
                        <p className="mt-0.5">{c.comment || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="comment">Comment</Label>
                <Textarea
                  id="comment"
                  placeholder="Enter assessment comment (max 500 characters)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">{comment.length}/500 characters</p>
              </div>

              {hasExistingComments && (
                <div className="flex items-center space-x-2 rounded-md border p-3">
                  <Checkbox
                    id="override"
                    checked={overridePrevious}
                    onCheckedChange={(checked) => setOverridePrevious(checked === true)}
                  />
                  <Label
                    htmlFor="override"
                    className="cursor-pointer text-sm font-normal"
                  >
                    Override previous comments (soft delete existing comments and save this as new)
                  </Label>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !comment.trim() || isLoading}
            >
              {mutation.isPending && (
                <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Comment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FitnessAssessmentCommentDialog;
