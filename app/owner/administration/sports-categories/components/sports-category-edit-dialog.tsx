'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoaderCircleIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';

type SportsCategory = {
	id: number;
	categoryName: string;
	description: string | null;
	isActive: boolean;
};

const SportsCategorySchema = z.object({
	categoryName: z.string().min(1).max(50),
	description: z.string().max(1000).nullable().optional(),
	isActive: z.boolean().optional(),
});

type SportsCategorySchemaType = z.infer<typeof SportsCategorySchema>;

const SportsCategoryEditDialog = ({ open, closeDialog, category }: { open: boolean; closeDialog: () => void; category: SportsCategory | null; }) => {
	const queryClient = useQueryClient();

	const form = useForm<SportsCategorySchemaType>({
		resolver: zodResolver(SportsCategorySchema),
		defaultValues: { categoryName: '', description: '', isActive: true },
		mode: 'onSubmit',
	});

	useEffect(() => {
		if (open) {
			form.reset({
				categoryName: category?.categoryName || '',
				description: category?.description ?? '',
				isActive: category?.isActive ?? true,
			});
		}
	}, [form, open, category]);

	const mutation = useMutation({
		mutationFn: async (values: SportsCategorySchemaType) => {
			const isEdit = !!category?.id;
			const url = isEdit
				? API_PATHS.administration.sportsCategories.byId(String(category?.id))
				: API_PATHS.administration.sportsCategories.list;
			const method = isEdit ? 'PUT' : 'POST';

			const response = await apiFetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				const { message } = await response.json();
				throw new Error(message);
			}

			return response.json();
		},
		onSuccess: () => {
			const isEdit = !!category?.id;
			const message = isEdit ? 'Category updated successfully' : 'Category added successfully';
			toast.custom(() => (
				<Alert variant="mono" icon="success">
					<AlertIcon>
						<RiCheckboxCircleFill />
					</AlertIcon>
					<AlertTitle>{message}</AlertTitle>
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

	const isLoading = mutation.status === 'pending';

	const handleSubmit = (values: SportsCategorySchemaType) => {
		mutation.mutate(values);
	};

	return (
		<Dialog open={open} onOpenChange={closeDialog}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)}>
						<DialogBody className="pt-2.5 space-y-6">
							<FormField
								control={form.control}
								name="categoryName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Category Name</FormLabel>
										<FormControl>
											<Input placeholder="Enter category name" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea placeholder="Enter description" {...field} value={field.value ?? ''} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</DialogBody>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
							<Button type="submit" disabled={!form.formState.isDirty || isLoading}>
								{isLoading && <LoaderCircleIcon className="animate-spin" />}
								Submit
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};

export default SportsCategoryEditDialog;


