'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ControllerRenderProps, FieldErrors, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoaderCircleIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSettings } from './components/settings-context';
import TimezoneSelect from './components/timezone-select';
import {
  GeneralSettingsSchema,
  GeneralSettingsSchemaType,
} from './forms/general-settings-schema';



export default function Page() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [logoExistingPreview, setLogoExistingPreview] = useState<string | null>(
    '',
  );
  const [logoAttachedPreview, setLogoAttachedPreview] = useState<string | null>(
    '',
  );
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  // Ensure all fields have default values
  const transformedSettings: GeneralSettingsSchemaType = {
    ...settings,
    logoFile: null,
    logoAction: '',
    name: settings?.name || '',
    active: settings?.active || true,
    address: settings?.address || '',
    websiteURL: settings?.websiteURL || '',
    supportEmail: settings?.supportEmail || '',
    supportPhone: settings?.supportPhone || '',
  };

  useEffect(() => {
    if (settings?.logo) {
      // Assume settings.logo contains the URL of the saved logo
      setLogoExistingPreview(settings.logo);
      setLogoAttachedPreview(null);
    }
  }, [settings]);

  const form = useForm<GeneralSettingsSchemaType>({
    resolver: zodResolver(GeneralSettingsSchema),
    defaultValues: transformedSettings,
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    mutationFn: async (values: GeneralSettingsSchemaType) => {
      const formData = new FormData();

      Object.keys(values).forEach((key) => {
        if (key === 'logoFile' && values.logoFile instanceof File) {
          formData.append('logoFile', values.logoFile);
        } else if (key !== 'logoFile') {
          formData.append(
            key,
            values[key as keyof GeneralSettingsSchemaType] as string,
          );
        }
      });

      const response = await apiFetch(API_PATHS.userManagement.settingsGeneral, {
        method: 'POST',
        body: formData,
      });

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
            <AlertTitle>Settings updated successfully</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );

      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error: Error) => {
      toast.custom(
        (t) => (
          <Alert
            variant="mono"
            icon="destructive"
            close={true}
            onClose={() => {
              toast.dismiss(t);
            }}
          >
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    },
  });

  const isProcessing = mutation.status === 'pending';

  const handleRemoveLogo = () => {
    setLogoExistingPreview(null);
    form.trigger('logoFile');
    form.setValue('logoFile', null);
    form.setValue('logoAction', 'remove', { shouldDirty: true });
  };

  const handleCancelLogo = () => {
    setLogoAttachedPreview(null);
    if (settings.logo) {
      setLogoExistingPreview(settings.logo);
    }
    form.setValue('logoFile', null);
    form.setValue('logoAction', '', { shouldDirty: true });
  };

  const handleChangeLogo = (
    e: ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<GeneralSettingsSchemaType, 'logoFile'>,
  ) => {
    const file = e.target.files?.[0] || null;
    field.onChange(file);
    form.trigger('logoFile');
    form.setValue('logoFile', file);
    form.setValue('logoAction', 'save', { shouldDirty: true });

    if (file) {
      const reader = new FileReader();
      reader.onload = () => setLogoAttachedPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoAttachedPreview(null);
    }
  };

  const handleFormReset = () => {
    form.reset(transformedSettings);
  };

  const handleSubmit = (values: GeneralSettingsSchemaType) => {
    mutation.mutate(values);
  };

  const handleError = (errors: FieldErrors<GeneralSettingsSchemaType>) => {
    // Cast keys as an array of keys of SocialSettingsSchemaType
    const keys = Object.keys(errors) as (keyof GeneralSettingsSchemaType)[];
    const firstErrorKey = keys[0];
    const firstErrorMessage = errors[firstErrorKey]?.message;

    if (firstErrorMessage) {
      toast.custom(
        (t) => (
          <Alert
            variant="mono"
            icon="destructive"
            close={true}
            onClose={() => {
              toast.dismiss(t);
            }}
          >
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>
              Your form has errors. Please fix them before submitting!
            </AlertTitle>
          </Alert>
        ),
        {
          position: 'top-center',
        },
      );
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent className="py-12">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            className="space-y-6 lg:max-w-[600px] mx-auto"
          >
            {/* Logo */}
            <FormField
              control={form.control}
              name="logoFile"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-5">
                    <div className="relative size-32 border rounded-lg overflow-hidden">
                      <img
                        src={
                          logoAttachedPreview ||
                          logoExistingPreview ||
                          '/media/ui/empty-image.svg'
                        }
                        alt="Logo preview"
                        className="object-cover size-full"
                      />
                    </div>
                    <div>
                      <FormLabel>Company Logo</FormLabel>
                      <FormControl className="my-1.5">
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => logoFileRef.current?.click()}
                            >
                              Attach Image
                            </Button>

                            {logoAttachedPreview ||
                            (!logoAttachedPreview &&
                              !logoExistingPreview &&
                              settings?.logo) ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancelLogo}
                              >
                                Cancel
                              </Button>
                            ) : null}

                            {settings?.logo &&
                            logoExistingPreview &&
                            !logoAttachedPreview ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleRemoveLogo}
                              >
                                Remove
                              </Button>
                            ) : null}
                          </div>
                          <input
                            ref={logoFileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleChangeLogo(e, field)}
                            aria-label="Upload company logo image"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        We support PNGs, JPEGs and GIFs under 1MB.
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Company Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shop Status</FormLabel>
                  <FormControl>
                    <div className="flex items-center space-x-2 rounded-lg bg-accent/60 p-4">
                      <Switch
                        id="active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <Label htmlFor="active">
                        Toggle the switch to enable or disable the store&apos;s
                        active status.
                      </Label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      id="address"
                      value={field.value || ''}
                      onChange={field.onChange}
                      placeholder="Enter store address"
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the full address of the store for customer reference.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
         

            {/* Website */}
            <FormField
              control={form.control}
              name="websiteURL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <Input
                      id="websiteURL"
                      type="url"
                      placeholder="Enter website url"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Support Email */}
            <FormField
              control={form.control}
              name="supportEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      id="supportEmail"
                      type="email"
                      placeholder="Enter support email"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Support Phone */}
            <FormField
              control={form.control}
              name="supportPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      id="supportPhone"
                      type="tel"
                      placeholder="Enter support phone"
                      value={field.value || ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />           

            {/* Action Buttons */}
            <div className="flex gap-2.5 justify-end">
              <Button type="button" variant="outline" onClick={handleFormReset}>
                Reset
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isDirty || isProcessing}
              >
                {isProcessing && <LoaderCircleIcon className="animate-spin" />}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
