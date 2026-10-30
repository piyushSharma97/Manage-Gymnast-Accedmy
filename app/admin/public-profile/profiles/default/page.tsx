'use client';

import { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { UserHero } from '@/partials/common/user-hero';
import { DropdownMenu9 } from '@/partials/dropdown-menu/dropdown-menu-9';
import { Navbar, NavbarActions } from '@/partials/navbar/navbar';
import {
  Building2,
  EllipsisVertical,
  Mail,
  MapPin,
  MessageSquareText,
  Shield,
  Users,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { getUserAccountPaths, sessionAvatarUrl } from '@/lib/user-account-nav';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/common/container';
import { PageMenu } from '@/app/admin/public-profile/page-menu';
import { ProfileRoleContent } from '@/app/admin/public-profile/profiles/default/components/profile-role-content';

export default function ProfileDefaultPage() {
  const { data: session, status } = useSession();
  const paths = useMemo(() => getUserAccountPaths(session?.user?.roleSlug), [session?.user?.roleSlug]);

  const displayName =
    session?.user?.name?.trim() ||
    [session?.user?.email?.split('@')[0]].filter(Boolean).join('') ||
    'Member';

  const avatarSrc = sessionAvatarUrl(session?.user?.avatar, toAbsoluteUrl);
  const email = session?.user?.email?.trim() || '';
  const roleLabel = session?.user?.roleName?.trim() || session?.user?.roleSlug || '';
  const tenantName = session?.user?.tenant?.academyName;
  const centerName = session?.user?.location?.centerName;
  const locationParts = [
    session?.user?.location?.city,
    session?.user?.location?.state,
    session?.user?.location?.country,
  ].filter(Boolean);
  const locationLabel =
    locationParts.length > 0 ? locationParts.join(', ') : centerName || '';

  const image = (
    <img
      src={avatarSrc}
      className="size-[100px] shrink-0 rounded-full border-3 border-primary/40 object-cover"
      alt=""
    />
  );

  const info = [
    ...(tenantName
      ? [{ label: tenantName, icon: Building2 }]
      : []),
    ...(locationLabel
      ? [{ label: locationLabel, icon: MapPin }]
      : []),
    ...(roleLabel
      ? [{ label: roleLabel, icon: Shield }]
      : []),
    ...(email
      ? [{ label: email, icon: Mail, href: `mailto:${encodeURIComponent(email)}` }]
      : []),
  ];

  return (
    <Fragment>
      <UserHero
        name={status === 'loading' ? '…' : displayName}
        image={image}
        info={info.length > 0 ? info : [{ label: 'My Academy member', icon: Shield }]}
      />
      <Container>
        <Navbar>
          <PageMenu />
          <NavbarActions>
            <Button variant="primary" asChild>
              <Link href={paths.myProfile}>
                <Users className="size-4" />
                Edit profile
              </Link>
            </Button>
            <Button variant="outline" mode="icon" asChild>
              <Link href={paths.myProfile} aria-label="Messages">
                <MessageSquareText />
              </Link>
            </Button>
            <DropdownMenu9
              trigger={
                <Button variant="outline" mode="icon">
                  <EllipsisVertical />
                </Button>
              }
            />
          </NavbarActions>
        </Navbar>
      </Container>
      <Container>
        <ProfileRoleContent />
      </Container>
    </Fragment>
  );
}
