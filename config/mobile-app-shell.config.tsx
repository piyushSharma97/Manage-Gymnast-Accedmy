import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  Play,
  ShieldUser,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { UserRole } from '@/constants/roles';

export type MobileNavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

export type MobileQuickTile = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type MobileShellRoleConfig = {
  suiteTitle: string;
  suiteIcon: LucideIcon;
  bottomNav: MobileNavItem[];
  quickTiles: MobileQuickTile[];
  /** When true, show the quick-actions grid on this path (role home / hub). */
  showQuickActionsOnPath: (pathname: string) => boolean;
};

function ownerHub(path: string) {
  return path === '/owner' || path === '/owner/';
}

function adminHub(path: string) {
  return path.startsWith('/admin/dashboard');
}

function managerHub(path: string) {
  return path.startsWith('/manager/dashboard');
}

function coachHub(path: string) {
  return path === '/coach/gymnast-management/students' || path.startsWith('/coach/gymnast-management/students/');
}

function parentHub(path: string) {
  return path === '/parent/dashboard' || path.startsWith('/parent/dashboard/');
}

export const MOBILE_SHELL_BY_ROLE: Record<string, MobileShellRoleConfig> = {
  owner: {
    suiteTitle: 'Owner Console',
    suiteIcon: ShieldUser,
    bottomNav: [
      { label: 'Home', icon: LayoutGrid, href: '/owner' },
      { label: 'Students', icon: Users, href: '/owner/students' },
      { label: 'Academies', icon: Building2, href: '/owner/tenant-management' },
      { label: 'Reports', icon: BarChart3, href: '/owner/reports' },
    ],
    quickTiles: [
      {
        title: 'Students',
        description: 'All academy students',
        href: '/owner/students',
        icon: Users,
      },
      {
        title: 'Academies',
        description: 'Tenants & centers',
        href: '/owner/tenant-management',
        icon: Building2,
      },
      {
        title: 'Sports & skills',
        description: 'Catalog configuration',
        href: '/owner/administration/sports-categories',
        icon: GraduationCap,
      },
      {
        title: 'User management',
        description: 'Roles & access',
        href: '/owner/user-management/users',
        icon: ShieldUser,
      },
      {
        title: 'Reports',
        description: 'Performance & revenue',
        href: '/owner/reports',
        icon: BarChart3,
      },
      {
        title: 'Skills library',
        description: 'Global skills',
        href: '/owner/skills',
        icon: Award,
      },
    ],
    showQuickActionsOnPath: ownerHub,
  },
  admin: {
    suiteTitle: 'Academy Admin',
    suiteIcon: LayoutGrid,
    bottomNav: [
      { label: 'Home', icon: LayoutGrid, href: '/admin/dashboard/batch' },
      { label: 'Students', icon: Users, href: '/admin/gymnast-management/students' },
      { label: 'Batches', icon: GraduationCap, href: '/admin/batch' },
      { label: 'Attendance', icon: CalendarCheck, href: '/admin/gymnast-management/attendance' },
      { label: 'Events', icon: ClipboardList, href: '/admin/event-management/events' },
    ],
    quickTiles: [
      {
        title: 'Students',
        description: 'Roster & profiles',
        href: '/admin/gymnast-management/students',
        icon: Users,
      },
      {
        title: 'Attendance',
        description: 'Daily check-in',
        href: '/admin/gymnast-management/attendance',
        icon: CalendarCheck,
      },
      {
        title: 'Batches',
        description: 'Groups & schedules',
        href: '/admin/batch',
        icon: GraduationCap,
      },
      {
        title: 'Fees',
        description: 'Invoices & payments',
        href: '/admin/fees/invoice',
        icon: Wallet,
      },
      {
        title: 'Skills assessment',
        description: 'HPC & scoring',
        href: '/admin/skills-assessment/assessment',
        icon: Award,
      },
      {
        title: 'Fitness',
        description: 'Workouts & plans',
        href: '/admin/fitness-workouts',
        icon: Zap,
      },
    ],
    showQuickActionsOnPath: adminHub,
  },
  manager: {
    suiteTitle: 'Center Manager',
    suiteIcon: LayoutGrid,
    bottomNav: [
      { label: 'Home', icon: LayoutGrid, href: '/manager/dashboard/batch' },
      { label: 'Students', icon: Users, href: '/manager/gymnast-management/students' },
      { label: 'Batches', icon: GraduationCap, href: '/manager/gymnast-management/batch' },
      { label: 'Attendance', icon: CalendarCheck, href: '/manager/gymnast-management/attendance' },
      { label: 'Fees', icon: Wallet, href: '/manager/fees/invoice' },
    ],
    quickTiles: [
      {
        title: 'Students',
        description: 'Center roster',
        href: '/manager/gymnast-management/students',
        icon: Users,
      },
      {
        title: 'Attendance',
        description: 'Mark attendance',
        href: '/manager/gymnast-management/attendance',
        icon: CalendarCheck,
      },
      {
        title: 'Trials',
        description: 'Trial pipeline',
        href: '/manager/gymnast-management/trial',
        icon: ClipboardList,
      },
      {
        title: 'Skills assessment',
        description: 'Assessments',
        href: '/manager/skills-assessment/assessment',
        icon: Award,
      },
      {
        title: 'Fitness',
        description: 'Workouts & feedback',
        href: '/manager/fitness-workouts',
        icon: Activity,
      },
      {
        title: 'Fees',
        description: 'Billing',
        href: '/manager/fees/payments',
        icon: Wallet,
      },
    ],
    showQuickActionsOnPath: managerHub,
  },
  coach: {
    suiteTitle: 'Coach Suite',
    suiteIcon: GraduationCap,
    bottomNav: [
      { label: 'Roster', icon: Users, href: '/coach/gymnast-management/students' },
      { label: 'Attendance', icon: CalendarCheck, href: '/coach/gymnast-management/attendance' },
      { label: 'Skills', icon: Award, href: '/coach/skills-assessment/assessment' },
      { label: 'Fitness', icon: Activity, href: '/coach/fitness-assessment/assessment' },
      { label: 'Workouts', icon: Zap, href: '/coach/fitness-workouts' },
      { label: 'Feedback', icon: MessageSquare, href: '/coach/feedback' },
    ],
    quickTiles: [
      {
        title: 'Attendance',
        description: 'Session check-in',
        href: '/coach/gymnast-management/attendance',
        icon: CalendarCheck,
      },
      {
        title: 'Skills assessment',
        description: 'Gymnastics scoring',
        href: '/coach/skills-assessment/assessment',
        icon: Award,
      },
      {
        title: 'Fitness test',
        description: 'Fitness assessment',
        href: '/coach/fitness-assessment/assessment',
        icon: Activity,
      },
      {
        title: 'Workouts',
        description: 'By level',
        href: '/coach/fitness-workouts',
        icon: Zap,
      },
      {
        title: 'Parent feedback',
        description: 'Messages',
        href: '/coach/feedback',
        icon: MessageSquare,
      },
      {
        title: 'Students',
        description: 'Full roster',
        href: '/coach/gymnast-management/students',
        icon: Users,
      },
    ],
    showQuickActionsOnPath: coachHub,
  },
  parent: {
    suiteTitle: 'Family Portal',
    suiteIcon: LayoutGrid,
    bottomNav: [
      { label: 'Home', icon: LayoutGrid, href: '/parent/dashboard' },
      { label: 'Tracker', icon: Activity, href: '/parent/tracker' },
      { label: 'Videos', icon: Play, href: '/parent/fitness-videos' },
      { label: 'Feedback', icon: MessageSquare, href: '/parent/feedback' },
    ],
    quickTiles: [
      {
        title: 'Dashboard',
        description: 'Child overview',
        href: '/parent/dashboard',
        icon: LayoutGrid,
      },
      {
        title: 'Attendance',
        description: 'Session history',
        href: '/parent/tracker/attendance',
        icon: CalendarCheck,
      },
      {
        title: 'Fitness',
        description: 'Activity & goals',
        href: '/parent/tracker/fitness',
        icon: Activity,
      },
      {
        title: 'Workouts',
        description: 'Coach workout list',
        href: '/parent/tracker/workouts',
        icon: Dumbbell,
      },
      {
        title: 'Skill progress',
        description: 'Assessments',
        href: '/parent/tracker/skill-assessment',
        icon: Award,
      },
      {
        title: 'Growth',
        description: 'Height & weight',
        href: '/parent/tracker/height-weight',
        icon: BarChart3,
      },
      {
        title: 'Videos',
        description: 'Home practice',
        href: '/parent/fitness-videos',
        icon: Play,
      },
    ],
    showQuickActionsOnPath: parentHub,
  },
  guardian: {
    suiteTitle: 'Family Portal',
    suiteIcon: LayoutGrid,
    bottomNav: [
      { label: 'Home', icon: LayoutGrid, href: '/parent/dashboard' },
      { label: 'Tracker', icon: Activity, href: '/parent/tracker' },
      { label: 'Videos', icon: Play, href: '/parent/fitness-videos' },
      { label: 'Feedback', icon: MessageSquare, href: '/parent/feedback' },
    ],
    quickTiles: [
      {
        title: 'Dashboard',
        description: 'Child overview',
        href: '/parent/dashboard',
        icon: LayoutGrid,
      },
      {
        title: 'Attendance',
        description: 'Session history',
        href: '/parent/tracker/attendance',
        icon: CalendarCheck,
      },
      {
        title: 'Fitness',
        description: 'Activity & goals',
        href: '/parent/tracker/fitness',
        icon: Activity,
      },
      {
        title: 'Workouts',
        description: 'Coach workout list',
        href: '/parent/tracker/workouts',
        icon: Dumbbell,
      },
      {
        title: 'Skill progress',
        description: 'Assessments',
        href: '/parent/tracker/skill-assessment',
        icon: Award,
      },
      {
        title: 'Growth',
        description: 'Height & weight',
        href: '/parent/tracker/height-weight',
        icon: BarChart3,
      },
      {
        title: 'Videos',
        description: 'Home practice',
        href: '/parent/fitness-videos',
        icon: Play,
      },
    ],
    showQuickActionsOnPath: parentHub,
  },
  default: {
    suiteTitle: 'My Academy',
    suiteIcon: LayoutGrid,
    bottomNav: [{ label: 'Home', icon: LayoutGrid, href: '/' }],
    quickTiles: [],
    showQuickActionsOnPath: () => false,
  },
};

export function getMobileShellConfig(
  roleSlug: string | undefined,
): MobileShellRoleConfig {
  if (!roleSlug) return MOBILE_SHELL_BY_ROLE.default;
  const r = roleSlug as UserRole;
  return MOBILE_SHELL_BY_ROLE[r] ?? MOBILE_SHELL_BY_ROLE.default;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  const base = href.split('?')[0];
  if (!base) return false;
  if (pathname === base) return true;
  if (base === '/parent/dashboard' && pathname.startsWith('/parent/dashboard')) {
    return true;
  }
  return pathname.startsWith(`${base}/`);
}
