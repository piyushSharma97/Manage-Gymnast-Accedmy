'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { useTenant } from '@/hooks/use-tenant';
import { getInitials, toAbsoluteUrl } from '@/lib/helpers';
import { sessionAvatarUrl } from '@/lib/user-account-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type MeProfileResponse = {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
  role: { slug: string; name: string } | null;
  tenant: {
    id: number;
    academyName: string;
    academyCode: string;
    subscriptionStatus: string;
  } | null;
  location: {
    id: number;
    centerName: string;
    centerCode: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  } | null;
};

interface IGeneralSettingsProps {
  title: string;
}

const BasicSettings = ({ title }: IGeneralSettingsProps) => {
  const queryClient = useQueryClient();
  const { data: session, update: updateSession } = useSession();
  const { tenant, location } = useTenant();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.me.profile);
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json() as Promise<MeProfileResponse>;
    },
  });

  useEffect(() => {
    if (data) {
      setName(data.name ?? '');
      setLastName(data.lastName ?? '');
    }
  }, [data]);

  const displayAvatar = sessionAvatarUrl(
    data?.avatar ?? session?.user?.avatar,
    toAbsoluteUrl,
  );

  const mutation = useMutation({
    mutationFn: async (payload: {
      name?: string;
      lastName?: string;
      avatar?: string | null;
    }) => {
      const res = await apiFetch(API_PATHS.me.profile, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err?.message === 'string' ? err.message : 'Update failed',
        );
      }
      return (await res.json()) as MeProfileResponse;
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['me-profile'] });
      const fullName = [updated.name, updated.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (session?.user) {
        await updateSession({
          user: {
            ...session.user,
            name: fullName || session.user.name,
            avatar: updated.avatar ?? session.user.avatar,
          },
        });
      }
      toast.success('Profile saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = mutation.isPending;

  const onAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('directory', 'avatars');
    const res = await apiFetch(API_PATHS.upload, { method: 'POST', body: fd });
    if (!res.ok) {
      toast.error('Could not upload image');
      return;
    }
    const { url } = (await res.json()) as { url: string };
    mutation.mutate({ avatar: url });
  };

  const onSave = () => {
    mutation.mutate({
      name: name.trim(),
      lastName: lastName.trim(),
    });
  };

  const orgTenant =
    tenant?.academyName ||
    data?.tenant?.academyName ||
    session?.user?.tenant?.academyName;
  const orgLocation =
    location?.centerName || data?.location?.centerName || session?.user?.location?.centerName;

  return (
    <Card className="pb-2.5">
      <CardHeader id="general_settings" className="scroll-mt-24">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Details used across My Academy for your account. Email changes may require admin support.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {(orgTenant || orgLocation) && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            {orgTenant ? (
              <p>
                <span className="text-muted-foreground">Academy: </span>
                {orgTenant}
              </p>
            ) : null}
            {orgLocation ? (
              <p className={orgTenant ? 'mt-1' : ''}>
                <span className="text-muted-foreground">Center: </span>
                {orgLocation}
              </p>
            ) : null}
            {data?.role?.name ? (
              <p className="mt-1">
                <span className="text-muted-foreground">Role: </span>
                {data.role.name}
              </p>
            ) : null}
          </div>
        )}

        <div
          id="profile_photo"
          className="flex flex-wrap items-center gap-4 scroll-mt-24 lg:flex-nowrap"
        >
          <Label className="w-full max-w-56 lg:w-auto">Photo</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="size-16 border border-border">
              <AvatarImage src={displayAvatar} alt="" className="object-cover" />
              <AvatarFallback>
                {getInitials(
                  [name, lastName].filter(Boolean).join(' ') || session?.user?.email,
                  2,
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                aria-label="Upload profile photo"
                onChange={onAvatarPick}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isLoading}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Change photo
              </Button>
              <span className="text-xs text-muted-foreground">
                JPEG, PNG, GIF or WebP · up to 5MB
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-2.5 lg:flex-nowrap">
          <Label className="flex w-full max-w-56">First name</Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            placeholder="First name"
          />
        </div>

        <div className="flex flex-wrap items-baseline gap-2.5 lg:flex-nowrap">
          <Label className="flex w-full max-w-56">Last name</Label>
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={isLoading}
            placeholder="Last name"
          />
        </div>

        <div className="flex flex-wrap items-baseline gap-2.5 lg:flex-nowrap">
          <Label className="flex w-full max-w-56">Email</Label>
          <Input
            type="email"
            value={data?.email ?? session?.user?.email ?? ''}
            disabled
            className="bg-muted/50"
          />
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={busy || isLoading}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export { BasicSettings, type IGeneralSettingsProps };
