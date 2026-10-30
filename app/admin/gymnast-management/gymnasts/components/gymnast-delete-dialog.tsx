'use client';

import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Student = {
  id: string;
  registrationNo: string;
  firstName: string;
};

export interface StudentDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  student: Student | null;
}

const StudentDeleteDialog = ({ open, closeDialog, student }: StudentDeleteDialogProps) => {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!student?.id) return;
      const response = await apiFetch(API_PATHS.student.byId(student.id), { method: 'DELETE' });
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => closeDialog(),
  });

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Student</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {student?.firstName} ({student?.registrationNo})?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Cancel</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.status === 'pending'}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDeleteDialog;


