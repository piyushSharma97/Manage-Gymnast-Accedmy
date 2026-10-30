'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';

type Batch = {
  id: number;
  studentId: string;
  course: {
    courseName: string;
    courseCode: string;
  };
  program: {
    name: string;
  };
  student?: {
    firstName: string;
    lastName: string;
  } | null;
};

export interface BatchDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  batch: Batch | null;
}

const BatchDeleteDialog = ({
  open,
  closeDialog,
  batch,
}: BatchDeleteDialogProps) => {
  const queryClient = useQueryClient();

  // Define the mutation for deleting the batch
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/api/batch/${batch?.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      const message = 'Batch deleted successfully';

      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );

      queryClient.invalidateQueries({ queryKey: ['admin-batches'] }); // Refetch batches list
      closeDialog();
    },
    onError: (error: Error) => {
      const message = error.message;
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
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
          Are you sure you want to delete the batch for{' '}
          <strong>
            {batch?.student 
              ? `${batch.student.firstName} ${batch.student.lastName}`
              : 'this student'}
          </strong> in course <strong>{batch?.course.courseName}</strong> ({batch?.course.courseCode}) under{' '}
          <strong>{batch?.program.name}</strong>?
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

export default BatchDeleteDialog;
