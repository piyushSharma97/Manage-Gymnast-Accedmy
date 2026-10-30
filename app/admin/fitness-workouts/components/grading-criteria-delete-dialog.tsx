'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Criterion = {
  id: number;
  level: string;
  description: string | null;
  targetValue: string | null;
};

type Props = {
  open: boolean;
  closeDialog: () => void;
  criterion: Criterion;
  queryKey: string;
};

export default function GradingCriteriaDeleteDialog({
  open,
  closeDialog,
  criterion,
  queryKey,
}: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(
        API_PATHS.administration.fitnessGradingCriteria.byId(String(criterion.id)),
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message);
      }
    },
    onSuccess: () => {
      toast.success('Criterion deleted');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete grading criterion</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete level <strong>{criterion.level}</strong>
          {criterion.targetValue && (
            <> (target: {criterion.targetValue})</>
          )}? This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
