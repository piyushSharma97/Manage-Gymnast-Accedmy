'use client';

import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import {
  Image as ImageIcon,
  KeyRound,
  SquarePen,
  User,
  UserCircle,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { toAbsoluteUrl } from '@/lib/helpers';
import {
  getUserAccountPaths,
  sessionAvatarUrl,
} from '@/lib/user-account-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserDropdownMenu({ trigger }: { trigger: ReactNode }) {
  const { data: session } = useSession();
  const roleSlug = session?.user?.roleSlug;
  const paths = useMemo(() => getUserAccountPaths(roleSlug), [roleSlug]);

  const avatarSrc = sessionAvatarUrl(
    session?.user?.avatar,
    toAbsoluteUrl,
  );

  const displayName = session?.user?.name?.trim() || 'Your account';
  const email = session?.user?.email || '';
  const roleLabel =
    session?.user?.roleName?.trim() ||
    (roleSlug
      ? roleSlug.charAt(0).toUpperCase() + roleSlug.slice(1)
      : 'Member');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64"
        side="bottom"
        align="end"
        sideOffset={4}
        alignOffset={0}
      >
        <div className="flex items-start gap-2.5 p-2">
          <img
            className="size-9 shrink-0 rounded-full border border-border object-cover"
            src={avatarSrc}
            alt=""
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold leading-tight">{displayName}</p>
            {email ? (
              <a
                href={`mailto:${encodeURIComponent(email)}`}
                className="block truncate text-xs text-muted-foreground hover:text-primary"
                onClick={(e) => e.stopPropagation()}
              >
                {email}
              </a>
            ) : null}
            <Badge variant="secondary" appearance="light" size="sm" className="mt-0.5">
              {roleLabel}
            </Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={paths.publicProfile} className="cursor-pointer">
            <UserCircle className="size-4 opacity-80" />
            Public profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={paths.myProfile} className="cursor-pointer">
            <User className="size-4 opacity-80" />
            My profile
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          My account
        </DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link href={paths.changeImage} className="cursor-pointer">
            <ImageIcon className="size-4 opacity-80" />
            Change image
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={paths.editProfile} className="cursor-pointer">
            <SquarePen className="size-4 opacity-80" />
            Edit profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={paths.editPassword} className="cursor-pointer">
            <KeyRound className="size-4 opacity-80" />
            Edit password
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="p-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            type="button"
            onClick={() => signOut()}
          >
            Log out
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
