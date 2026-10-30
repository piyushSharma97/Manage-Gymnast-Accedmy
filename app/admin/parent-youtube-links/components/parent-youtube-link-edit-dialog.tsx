'use client';

import { useEffect } from 'react';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { LoaderCircleIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  ParentYoutubeLinkSchema,
  ParentYoutubeLinkSchemaType,
} from '../forms/parent-youtube-link-schema';

type ParentYoutubeLink = {
  id: number;
  link: string;
  description: string | null;
};

export interface ParentYoutubeLinkEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  parentYoutubeLink: ParentYoutubeLink | null;
  apiBasePath?: string;
  queryKey?: string;
}

const ParentYoutubeLinkEditDialog = ({
  open,
  closeDialog,
  parentYoutubeLink,
  apiBasePath = '/api/administration/parent-youtube-links',
  queryKey = 'admin-parent-youtube-links',
}: ParentYoutubeLinkEditDialogProps) => {
  const queryClient = useQueryClient();

  const form = useForm<ParentYoutubeLinkSchemaType>({
    resolver: zodResolver(ParentYoutubeLinkSchema),
    defaultValues: {
      link: '',
      description: '',
    },
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (open) {
      form.reset({
        link: parentYoutubeLink?.link || '',
        description: parentYoutubeLink?.description ?? '',
      });
    }
  }, [form, open, parentYoutubeLink]);

  const mutation = useMutation({
    mutationFn: async (values: ParentYoutubeLinkSchemaType) => {
      const isEdit = !!parentYoutubeLink?.id;
      const url = isEdit
        ? `${apiBasePath}/${parentYoutubeLink.id}`
        : apiBasePath;
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
      const isEdit = !!parentYoutubeLink?.id;
      const message = isEdit
        ? 'YouTube link updated successfully'
        : 'YouTube link added successfully';

      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{message}</AlertTitle>
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

  const isLoading = mutation.status === 'pending';

  const handleSubmit = (values: ParentYoutubeLinkSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {parentYoutubeLink ? 'Edit YouTube Link' : 'Add YouTube Link'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Link</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=..."
                      {...field}
                    />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Short description for parents"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
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

export default ParentYoutubeLinkEditDialog;
