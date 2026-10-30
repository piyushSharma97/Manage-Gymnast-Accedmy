'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';

type Payment = {
  id: string;
  student: {
    firstName: string;
    lastName: string | null;
    registrationNo: string;
  };
  amountPaid: number | string;
};

export interface PaymentDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  payment: Payment | null;
}

const PaymentDeleteDialog = ({
  open,
  closeDialog,
  payment,
}: PaymentDeleteDialogProps) => {
  const queryClient = useQueryClient();

  // Define the mutation for deleting the payment
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/api/fees/payments/${payment?.id}`,
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
      const message = 'Payment deleted successfully';

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

      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
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
          Are you sure you want to delete the payment for{' '}
          <strong>
            {payment?.student.firstName} {payment?.student.lastName || ''}
          </strong>{' '}
          ({payment?.student.registrationNo})?
          {payment?.amountPaid && (
            <>
              <br />
              Amount Paid: <strong>${typeof payment.amountPaid === 'number' ? payment.amountPaid.toFixed(2) : parseFloat(payment.amountPaid).toFixed(2)}</strong>
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

export default PaymentDeleteDialog;

