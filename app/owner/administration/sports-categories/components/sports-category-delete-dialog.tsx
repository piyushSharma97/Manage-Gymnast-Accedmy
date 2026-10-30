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

type SportsCategory = {
	id: number;
	categoryName: string;
};

const SportsCategoryDeleteDialog = ({ open, closeDialog, category }: { open: boolean; closeDialog: () => void; category: SportsCategory; }) => {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: async () => {
			const response = await apiFetch(API_PATHS.administration.sportsCategories.byId(String(category.id)), { method: 'DELETE' });
			if (!response.ok) {
				const { message } = await response.json();
				throw new Error(message);
			}
			return response.json();
		},
		onSuccess: () => {
			toast.custom(() => (
				<Alert variant="mono" icon="success">
					<AlertIcon>
						<RiCheckboxCircleFill />
					</AlertIcon>
					<AlertTitle>Category deleted successfully</AlertTitle>
				</Alert>
			), { position: 'top-center' });
			queryClient.invalidateQueries({ queryKey: ['admin-sports-categories'] });
			closeDialog();
		},
		onError: (error: Error) => {
			toast.custom(() => (
				<Alert variant="mono" icon="destructive">
					<AlertIcon>
						<RiErrorWarningFill />
					</AlertIcon>
					<AlertTitle>{error.message}</AlertTitle>
				</Alert>
			), { position: 'top-center' });
		},
	});

	return (
		<Dialog open={open} onOpenChange={closeDialog}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Confirm Delete</DialogTitle>
				</DialogHeader>
				<DialogDescription>
					Are you sure you want to delete the category?
				</DialogDescription>
				<DialogFooter>
					<Button variant="outline" onClick={closeDialog}>Cancel</Button>
					<Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.status === 'pending'}>
						{mutation.status === 'pending' && <LoaderCircleIcon className="animate-spin" />}
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default SportsCategoryDeleteDialog;


