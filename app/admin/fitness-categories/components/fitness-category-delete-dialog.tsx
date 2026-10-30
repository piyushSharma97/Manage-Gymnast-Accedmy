'use client';

import { useState } from 'react';
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

type FitnessCategory = {
  id: number;
  name: string;
};

type Props = {
  open: boolean;
  closeDialog: () => void;
  category: FitnessCategory;
  queryKey: string;
};

export default function FitnessCategoryDeleteDialog({
  open,
  closeDialog,
  category,
  queryKey,
}: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(
        API_PATHS.administration.fitnessCategories.byId(String(category.id)),
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const { message } = await res.json();
        throw new Error(message);
      }
    },
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLoading(false);
    },
  });

  const handleDelete = () => {
    setLoading(true);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{category.name}</strong>? This will fail if any
          fitness skills use this category.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
