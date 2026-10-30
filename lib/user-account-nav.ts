/**
 * Role-scoped account and profile URLs. Account UI is implemented under each
 * app segment (admin, manager, coach, parent) so middleware stays correct.
 */

export type AccountPaths = {
  publicProfile: string;
  myProfile: string;
  changeImage: string;
  editProfile: string;
  editPassword: string;
};

function roleHomeSegment(roleSlug: string | null | undefined): string {
  switch (roleSlug) {
    case 'admin':
      return 'admin';
    case 'manager':
      return 'manager';
    case 'coach':
      return 'coach';
    case 'parent':
    case 'guardian':
      return 'parent';
    default:
      return 'admin';
  }
}

export function getUserAccountPaths(
  roleSlug: string | null | undefined,
): AccountPaths {
  const home = roleHomeSegment(roleSlug);
  const base = `/${home}`;
  const settings = `${base}/account/home/settings-plain`;
  return {
    publicProfile: `${base}/public-profile/profiles/default`,
    myProfile: settings,
    changeImage: `${settings}#profile_photo`,
    editProfile: `${settings}#general_settings`,
    editPassword: `${settings}#password_settings`,
  };
}

export function isTenantAdmin(roleSlug: string | null | undefined): boolean {
  return roleSlug === 'admin';
}

/** Avatar URL for <img src>; uses absolute URLs as-is, otherwise `toAbsoluteUrl`. */
export function sessionAvatarUrl(
  avatar: string | null | undefined,
  toAbsoluteUrl: (pathname: string) => string,
  fallbackPath = '/media/avatars/300-2.png',
): string {
  if (!avatar) {
    return toAbsoluteUrl(fallbackPath);
  }
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  const path = avatar.startsWith('/') ? avatar : `/${avatar}`;
  return toAbsoluteUrl(path);
}
