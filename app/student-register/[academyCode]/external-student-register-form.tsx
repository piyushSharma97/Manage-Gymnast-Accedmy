'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { toast } from 'sonner';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { RecaptchaPopover } from '@/components/common/recaptcha-popover';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const ExternalStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().min(1, 'Email is required').max(100).email('Enter a valid email'),
  phone: z
    .string()
    .min(1, 'Phone is required')
    .max(10, 'At most 10 digits')
    .regex(/^\d+$/, 'Digits only'),
  gender: z.enum(['Male', 'Female']),
  dob: z.string().min(1, 'Date of birth is required'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  schoolName: z.string().min(1, 'School name is required').max(100),
  Board: z.enum(['CBSE', 'ICSE', 'IB', 'State']),
  gradeClass: z.string().min(1, 'Grade/class is required').max(20),
  locationId: z.number().min(1, 'Select a location'),
  addressLine1: z.string().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  guardianFirstName: z.string().min(1, 'Parent first name is required').max(100),
  guardianLastName: z.string().min(1, 'Parent last name is required').max(100),
  profilePhotoUrl: z.string().optional(),
});

export type ExternalStudentSchemaType = z.infer<typeof ExternalStudentSchema>;

type Meta = {
  academyName: string;
  academyCode: string;
  locations: { id: number; centerName: string }[];
};

function PublicPhotoUpload({
  academyCode,
  value,
  onChange,
}: {
  academyCode: string;
  value?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) setPreview(value);
  }, [value]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be 5MB or less.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'students');

      const response = await apiFetch(API_PATHS.publicStudentRegister.upload(academyCode), {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const j = await response.json().catch(() => ({}));
        throw new Error(j?.message || 'Upload failed');
      }
      const { url } = await response.json();
      onChange(url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Upload failed';
      toast.error(message);
      setPreview(value || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label>Profile photo (optional)</Label>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          {preview ? (
            <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-border">
              <img src={preview} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="public-photo-upload"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? 'Uploading…' : preview ? 'Change photo' : 'Upload photo'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Optional. Max 5MB.</p>
        </div>
      </div>
    </div>
  );
}

export function ExternalStudentRegisterForm({ academyCode }: { academyCode: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [success, setSuccess] = useState<{ registrationNo: string } | null>(null);
  const [showRecaptcha, setShowRecaptcha] = useState(false);

  const form = useForm<ExternalStudentSchemaType>({
    resolver: zodResolver(ExternalStudentSchema),
    defaultValues: {
      gender: 'Male',
      addressLine2: '',
      profilePhotoUrl: '',
      locationId: 0,
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const res = await apiFetch(API_PATHS.publicStudentRegister.meta(academyCode));
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.message || 'Could not load registration page.');
        }
        const data = (await res.json()) as Meta;
        if (!cancelled) setMeta(data);
      } catch (e: unknown) {
        if (!cancelled) setMetaError(e instanceof Error ? e.message : 'Failed to load.');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academyCode]);

  const mutation = useMutation({
    mutationFn: async ({
      values,
      recaptchaToken,
    }: {
      values: ExternalStudentSchemaType;
      recaptchaToken: string;
    }) => {
      const { profilePhotoUrl, addressLine2, ...rest } = values;
      const payload = {
        ...rest,
        addressLine2: addressLine2?.trim() || undefined,
        profilePhotoUrl: profilePhotoUrl?.trim() || undefined,
      };
      const response = await apiFetch(API_PATHS.publicStudentRegister.submit(academyCode), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-recaptcha-token': recaptchaToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Registration failed');
      }
      return data as { registrationNo?: string };
    },
    onSuccess: (data) => {
      setSuccess({
        registrationNo: data.registrationNo ?? '',
      });
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>Registration submitted successfully</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
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

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valid = await form.trigger();
    if (!valid) return;
    setShowRecaptcha(true);
  };

  const handleVerifiedSubmit = (token: string) => {
    setShowRecaptcha(false);
    mutation.mutate({ values: form.getValues(), recaptchaToken: token });
  };

  if (loadingMeta) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>Loading…</p>
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Registration unavailable</CardTitle>
          <CardDescription>{metaError || 'Invalid link.'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (meta.locations.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{meta.academyName}</CardTitle>
          <CardDescription>
            Online registration is not available yet — no active locations for this academy. Please
            contact the academy directly.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>Thank you</CardTitle>
          <CardDescription>
            Your registration for <span className="font-medium text-foreground">{meta.academyName}</span>{' '}
            was received
            {success.registrationNo ? (
              <>
                . Your registration number is{' '}
                <span className="font-mono font-semibold text-foreground">{success.registrationNo}</span>.
              </>
            ) : (
              '.'
            )}
          </CardDescription>
          <p className="pt-2 text-sm text-muted-foreground">
            If a new account was created for this email, check your inbox to set your password.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Student registration</CardTitle>
        <CardDescription>
          {meta.academyName}
          <span className="mt-1 block font-mono text-xs text-muted-foreground">{meta.academyCode}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Branch / location *</Label>
              <Select
                value={
                  form.watch('locationId') && form.watch('locationId') > 0
                    ? String(form.watch('locationId'))
                    : ''
                }
                onValueChange={(v) => form.setValue('locationId', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch or location" />
                </SelectTrigger>
                <SelectContent>
                  {meta.locations.map((loc) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>
                      {loc.centerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.locationId && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.locationId.message}</p>
              )}
            </div>
            <div>
              <Label>First name *</Label>
              <Input {...form.register('firstName')} maxLength={100} autoComplete="given-name" />
              {form.formState.errors.firstName && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label>Last name *</Label>
              <Input {...form.register('lastName')} maxLength={100} autoComplete="family-name" />
              {form.formState.errors.lastName && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.lastName.message}</p>
              )}
            </div>
            <div>
              <Label>Gender *</Label>
              <Select
                value={form.watch('gender')}
                onValueChange={(val) => form.setValue('gender', val as 'Male' | 'Female')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date of birth *</Label>
              <Input type="date" {...form.register('dob')} />
              {form.formState.errors.dob && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.dob.message}</p>
              )}
            </div>
            <div>
              <Label>Blood group *</Label>
              <Select
                value={form.watch('bloodGroup') || ''}
                onValueChange={(val) =>
                  form.setValue('bloodGroup', val as ExternalStudentSchemaType['bloodGroup'])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const).map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.bloodGroup && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.bloodGroup.message}</p>
              )}
            </div>
            <div>
              <Label>School name *</Label>
              <Input {...form.register('schoolName')} maxLength={100} />
              {form.formState.errors.schoolName && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.schoolName.message}</p>
              )}
            </div>
            <div>
              <Label>Board *</Label>
              <Select
                value={form.watch('Board') || ''}
                onValueChange={(val) =>
                  form.setValue('Board', val as ExternalStudentSchemaType['Board'])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Board" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBSE">CBSE</SelectItem>
                  <SelectItem value="ICSE">ICSE</SelectItem>
                  <SelectItem value="IB">IB</SelectItem>
                  <SelectItem value="State">State</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.Board && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.Board.message}</p>
              )}
            </div>
            <div>
              <Label>Grade / class *</Label>
              <Input {...form.register('gradeClass')} maxLength={20} />
              {form.formState.errors.gradeClass && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.gradeClass.message}</p>
              )}
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" {...form.register('email')} maxLength={100} autoComplete="email" />
              {form.formState.errors.email && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                type="tel"
                maxLength={10}
                inputMode="numeric"
                autoComplete="tel"
                {...form.register('phone')}
                onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, ''))}
              />
              {form.formState.errors.phone && (
                <p className="mt-1 text-sm text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="border-t pt-6">
            <PublicPhotoUpload
              academyCode={academyCode}
              value={form.watch('profilePhotoUrl')}
              onChange={(url) => form.setValue('profilePhotoUrl', url)}
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Address line 1 *</Label>
                <Input {...form.register('addressLine1')} autoComplete="street-address" />
                {form.formState.errors.addressLine1 && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.addressLine1.message}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>Address line 2 (optional)</Label>
                <Input {...form.register('addressLine2')} />
              </div>
              <div>
                <Label>City *</Label>
                <Input {...form.register('city')} autoComplete="address-level2" />
                {form.formState.errors.city && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.city.message}</p>
                )}
              </div>
              <div>
                <Label>State *</Label>
                <Select
                  value={form.watch('state') || ''}
                  onValueChange={(val) => form.setValue('state', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.state && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.state.message}</p>
                )}
              </div>
              <div>
                <Label>Postal code *</Label>
                <Input {...form.register('postalCode')} autoComplete="postal-code" />
                {form.formState.errors.postalCode && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.postalCode.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Parent / guardian</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Parent first name *</Label>
                <Input {...form.register('guardianFirstName')} maxLength={100} />
                {form.formState.errors.guardianFirstName && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.guardianFirstName.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Parent last name *</Label>
                <Input {...form.register('guardianLastName')} maxLength={100} />
                {form.formState.errors.guardianLastName && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.guardianLastName.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <RecaptchaPopover
              open={showRecaptcha}
              onOpenChange={(open) => {
                if (!open) setShowRecaptcha(false);
              }}
              onVerify={handleVerifiedSubmit}
              verifyButtonText="Verify & submit"
              trigger={
                <Button type="submit" disabled={mutation.isPending} className="min-w-[160px]">
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit registration'
                  )}
                </Button>
              }
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
