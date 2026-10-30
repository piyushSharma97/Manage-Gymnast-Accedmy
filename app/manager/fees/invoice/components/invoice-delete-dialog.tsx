'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';

type Invoice = {
  id: string;
  student: {
    firstName: string;
    lastName: string | null;
    registrationNo: string;
  };
  amount: number | string | null;
  status: string;
};

export interface InvoiceDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  invoice: Invoice | null;
}

const InvoiceDeleteDialog = ({
  open,
  closeDialog,
  invoice,
}: InvoiceDeleteDialogProps) => {
  const queryClient = useQueryClient();

  // Define the mutation for deleting the invoice
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/api/fees/invoice/${invoice?.id}`,
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
      const message = 'Invoice deleted successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
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
          Are you sure you want to delete the invoice for{' '}
          <strong>
            {invoice?.student.firstName} {invoice?.student.lastName || ''}
          </strong>{' '}
          ({invoice?.student.registrationNo})?
          {invoice?.amount && (
            <>
              <br />
              Amount: <strong>${typeof invoice.amount === 'number' ? invoice.amount.toFixed(2) : parseFloat(invoice.amount).toFixed(2)}</strong>
            </>
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

export default InvoiceDeleteDialog;

