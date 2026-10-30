'use client';

import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoaderCircleIcon } from 'lucide-react';

type Tenant = {
	id: number;
	academyName: string;
	academyCode: string;
	primaryEmail: string;
	city: string;
	state: string;
	country: string;
};

export interface TenantDeleteDialogProps {
  open: boolean;
  closeDialog: () => void;
  tenant: Tenant;
}

const TenantDeleteDialog = ({
  open,
  closeDialog,
  tenant,
}: TenantDeleteDialogProps) => {
  const queryClient = useQueryClient();

  // Define the mutation for deleting the tenant
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        API_PATHS.tenantManagement.byId(String(tenant.id)),
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
      const message = 'Tenant deleted successfully';

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

      queryClient.invalidateQueries({ queryKey: ['tenant-management'] }); // Refetch tenants list
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
          Are you sure you want to delete the tenant{' '}
          <strong>{tenant.academyName}</strong> ({tenant.academyCode})?
          <br />
          <br />
          <strong>Location:</strong> {tenant.city}, {tenant.state}, {tenant.country}
          <br />
          <strong>Email:</strong> {tenant.primaryEmail}
          <br />
          <br />
          This action cannot be undone and will permanently delete all tenant data.
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

export default TenantDeleteDialog;
