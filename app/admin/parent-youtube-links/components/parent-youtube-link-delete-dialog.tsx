'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';

type ParentYoutubeLink = {
  id: number;
  link: string;
  description: string | null;
};

export interface ParentYoutubeLinkDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  parentYoutubeLink: ParentYoutubeLink;
  apiBasePath?: string;
  queryKey?: string;
}

const ParentYoutubeLinkDeleteDialog = ({
  open,
  closeDialog,
  parentYoutubeLink,
  apiBasePath = '/api/administration/parent-youtube-links',
  queryKey = 'admin-parent-youtube-links',
}: ParentYoutubeLinkDeleteDialogProps) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `${apiBasePath}/${parentYoutubeLink.id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
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
            <AlertTitle>YouTube link deleted successfully</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );

      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
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
        { position: 'top-center' },
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you want to delete this YouTube link? It will no longer
          be available for the parent panel.
          {parentYoutubeLink.description && (
            <span className="mt-2 block text-muted-foreground">
              &ldquo;{parentYoutubeLink.description}&rdquo;
            </span>
          )}
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.status === 'pending'}
          >
            {mutation.status === 'pending' && (
              <LoaderCircleIcon className="animate-spin" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ParentYoutubeLinkDeleteDialog;
