import {
  AlertCircle,
  Award,
  Badge,
  Bell,
  Bitcoin,
  Bolt,
  Book,
  Briefcase,
  Building,
  Calendar,
  CalendarCheck,
  Captions,
  CheckCircle,
  Code,
  Codepen,
  Coffee,
  File as DocumentIcon,
  Euro,
  Eye,
  File,
  FileQuestion,
  FileText,
  Flag,
  Ghost,
  Gift,
  Grid,
  Heart,
  HelpCircle,
  Kanban,
  Key,
  Layout,
  LayoutGrid,
  LifeBuoy,
  MessageSquare,
  Monitor,
  Network,
  Users as PeopleIcon,
  Play,
  Plug,
  Ruler,
  ScrollText,
  Settings,
  Share2,
  Shield,
  ShieldUser,
  ShoppingCart,
  SquareMousePointer,
  Star,
  Theater,
  TrendingUp,
  UserCheck,
  UserCircle,
  Users,
  Briefcase as WorkIcon,
  Zap,
  Activity,
  Dumbbell,
} from 'lucide-react';
import { type MenuConfig } from './types';

/**
 * Main sidebar menu configuration with role-based access control
 * 
 * Each role (admin, owner, manager) has completely separate menus with no sharing.
 * All menu items use strictRoleMatch: true to ensure complete separation.
 * 
 * Role Hierarchy (from highest to lowest):
 * - owner: Full system access, can manage tenants
 * - admin: Can manage users, programs, courses
 * - manager: Can manage teams, batches, employees  
 * - staff: Can view and manage assigned batches
 * - member: Basic user access
 * 
 * MENU_SIDEBAR is side menu for the admin panel.
 */
export const MENU_SIDEBAR: MenuConfig = [
  // ==================== OWNER MENU ITEMS ====================
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/',
    roles: ['owner'],
    strictRoleMatch: true // Only visible to owner
  },
  {
    title: 'Students',
    icon: Users,
    roles: ['owner'],
    strictRoleMatch: true, // Only visible to owner
    children: [
      { 
        title: 'Students', 
        path: '/owner/students',
        roles: ['owner'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
    ] 
  },
  {
    title: 'Administration',
    icon: ShieldUser,
    roles: ['owner'],
    strictRoleMatch: true, // Only visible to owner
    children: [
      { 
        title: 'Academies', 
        path: '/owner/tenant-management',
        roles: ['owner'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },     
      { 
        title: 'Sports Categories', 
        path: '/owner/administration/sports-categories',
        roles: ['owner'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
      { 
        title: 'Skills', 
        path: '/owner/skills',
        roles: ['owner'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
    ],
  },
  {
    title: 'Reports',
    roles: ['owner'],
    icon: ShieldUser,
    strictRoleMatch: true, // Only visible to owner
    children: [
      { 
        title: 'Center Performance & Revenue', 
        path: '/owner/reports/performance',
        roles: ['owner'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'User Management',
    roles: ['owner'],
    icon: ShieldUser,
    strictRoleMatch: true, // Only visible to owner
    children: [
      { 
        title: 'Users', 
        path: '/owner/user-management/users',
        roles: ['owner'],
        strictRoleMatch: true
      },
      {
        title: 'Roles',
        path: '/owner/user-management/roles',
        roles: ['owner'],
        strictRoleMatch: true
      },
      {
        title: 'Permissions',
        path: '/owner/user-management/permissions',
        roles: ['owner'],
        strictRoleMatch: true
      },
      {
        title: 'Logs',
        path: '/owner/user-management/logs',
        roles: ['owner'],
        strictRoleMatch: true
      },
      {
        title: 'Settings',
        path: '/owner/user-management/settings',
        roles: ['owner'],
        strictRoleMatch: true
      },
    ],
  },

  // ==================== ADMIN MENU ITEMS ====================
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/admin/dashboard/batch',
    roles: ['admin'],
    strictRoleMatch: true // Only visible to admin
  },
  {
    title: 'Students',
    icon: Users,
    roles: ['admin'],
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Trials', 
        path: '/admin/trial',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },     
      { 
        title: 'Students', 
        path: '/admin/gymnast-management/students',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
      { 
        title: 'Siblings', 
        path: '/admin/gymnast-management/siblings',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
      { 
        title: 'Batches', 
        path: '/admin/batch',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Attendance', 
        path: '/admin/gymnast-management/attendance',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Inactive Students', 
        path: '/admin/gymnast-management/inactive',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
      { 
        title: 'Birthdays', 
        path: '/admin/gymnast-management/birthdays',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
    ],
  },
  {
    title: 'Fees',
    icon: Users,
    roles: ['admin'],
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Invoice', 
        path: '/admin/fees/invoice',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      }, 
      { 
        title: 'Fees Collection', 
        path: '/admin/fees/payments',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      }, 
    ]
  },
  {
    title: 'Events',
    roles: ['admin'],
    strictRoleMatch: true, // Only visible to admin
    icon: CalendarCheck,
    children: [
      {
        title: 'Events',
        path: '/admin/event-management/events',
        roles: ['admin'],
        strictRoleMatch: true
      },
      {
        title: 'Register Gymnast',
        path: '/admin/event-management/register-gymnast',
        roles: ['admin'],
        strictRoleMatch: true
      }
    ]
  },
  {
    title: 'Administration',
    icon: ShieldUser,
    roles: ['admin'],
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Locations', 
        path: '/admin/location',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Levels', 
        path: '/admin/skilllevel',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Programs', 
        path: '/admin/program',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Courses', 
        path: '/admin/course',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Skills', 
        path: '/admin/skills',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
      {
        title: 'Fitness Categories',  
        path: '/admin/fitness-categories',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      {
        title: 'Fitness Skills',
        path: '/admin/fitness-skills',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Fitness Workouts', 
        path: '/admin/fitness-workouts',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Parent YouTube Links', 
        path: '/admin/parent-youtube-links',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },      
      { 
        title: 'Teams', 
        path: '/admin/team',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Skills Assessment',
    roles: ['admin'],
    icon: Award,
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Assessment', 
        path: '/admin/skills-assessment/assessment',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fitness Assessment',
    roles: ['admin'],
    icon: Activity,
    strictRoleMatch: true,
    children: [
      { 
        title: 'Assessment', 
        path: '/admin/fitness-assessment/assessment',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Reports',
    roles: ['admin'],
    icon: ShieldUser,
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Monthly Attendance & Billing', 
        path: '/admin/reports/attendance/monthly',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Individual Student Attendance', 
        path: '/admin/reports/attendance/student',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Student Attendance Calendar', 
        path: '/admin/reports/attendance/calendar',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Uninvoiced Students', 
        path: '/admin/reports/uninvoiced',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      }  
    ],
  },
  {
    title: 'User Management',
    roles: ['admin'],
    icon: ShieldUser,
    strictRoleMatch: true, // Only visible to admin
    children: [
      { 
        title: 'Employees', 
        path: '/admin/employee',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Parent Feedback', 
        path: '/admin/feedback',
        roles: ['admin'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      // {
      //   title: 'Account',
      //   path: '/owner/user-management/account',
      //   roles: ['admin'],
      //   strictRoleMatch: true
      // },
    ],
  },

  // ==================== MANAGER MENU ITEMS ====================
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/manager/dashboard/batch',
    roles: ['manager'],
    strictRoleMatch: true // Only visible to manager
  },
  {
    title: 'Students',
    icon: Users,
    roles: ['manager'],
    strictRoleMatch: true, // Only visible to manager
    children: [
      { 
        title: 'Trials', 
        path: '/manager/gymnast-management/trial',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },     
      { 
        title: 'Students', 
        path: '/manager/gymnast-management/students',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Siblings', 
        path: '/manager/gymnast-management/siblings',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Batches', 
        path: '/manager/gymnast-management/batch',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Attendance', 
        path: '/manager/gymnast-management/attendance',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Inactive Students', 
        path: '/manager/gymnast-management/inactive',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Birthdays', 
        path: '/manager/gymnast-management/birthdays',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fees',
    icon: Users,
    roles: ['manager'],
    strictRoleMatch: true, // Only visible to manager
    children: [
      { 
        title: 'Invoice', 
        path: '/manager/fees/invoice',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      }, 
      { 
        title: 'Fees Collection', 
        path: '/manager/fees/payments',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: false
      },
    ]
  },
  {
    title: 'Skills Assessment',
    roles: ['manager'],
    icon: Award,
    strictRoleMatch: true, // Only visible to manager
    children: [
      { 
        title: 'Assessment', 
        path: '/manager/skills-assessment/assessment',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fitness Assessment',
    roles: ['manager'],
    icon: Activity,
    strictRoleMatch: true,
    children: [
      { 
        title: 'Assessment', 
        path: '/manager/fitness-assessment/assessment',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fitness',
    roles: ['manager'],
    icon: Zap,
    strictRoleMatch: true,
    children: [
      { 
        title: 'Fitness Skills', 
        path: '/manager/fitness-skills',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Fitness Workouts', 
        path: '/manager/fitness-workouts',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Parent Feedback', 
        path: '/manager/feedback',
        roles: ['manager'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },

  // ==================== COACH MENU ITEMS ====================
  {
    title: 'Students',
    icon: Users,
    roles: ['coach'],
    strictRoleMatch: true, // Only visible to Coach
    children: [
      { 
        title: 'Students', 
        path: '/coach/gymnast-management/students',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
      { 
        title: 'Attendance', 
        path: '/coach/gymnast-management/attendance',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Skills Assessment',
    roles: ['coach'],
    icon: Award,
    strictRoleMatch: true, // Only visible to Coach
    children: [
      { 
        title: 'Assessment', 
        path: '/coach/skills-assessment/assessment',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fitness Assessment',
    roles: ['coach'],
    icon: Activity,
    strictRoleMatch: true,
    children: [
      { 
        title: 'Assessment', 
        path: '/coach/fitness-assessment/assessment',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Fitness Workouts',
    roles: ['coach'],
    icon: Activity,
    strictRoleMatch: true, // Only visible to Coach
    children: [
      { 
        title: 'Workouts by Level', 
        path: '/coach/fitness-workouts',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true
      },
    ],
  },
  {
    title: 'Parent Feedback',
    roles: ['coach'],
    icon: MessageSquare,
    strictRoleMatch: true,
    children: [
      {
        title: 'Feedback',
        path: '/coach/feedback',
        roles: ['coach'],
        strictRoleMatch: true,
        requiresActiveTenant: true,
      },
    ],
  },

  // ==================== PARENT MENU ITEMS ====================
  {
    title: 'Dashboard',
    icon: LayoutGrid,
    path: '/parent/dashboard',
    roles: ['parent', 'guardian'],
    strictRoleMatch: true,
  },
  {
    title: 'Fitness Videos',
    icon: Play,
    path: '/parent/fitness-videos',
    roles: ['parent', 'guardian'],
    strictRoleMatch: true,
  },
  {
    title: 'Tracker',
    icon: Activity,
    path: '/parent/tracker',
    roles: ['parent', 'guardian'],
    strictRoleMatch: true,
    children: [
      { title: 'Attendance', path: '/parent/tracker/attendance', icon: Calendar, roles: ['parent', 'guardian'], strictRoleMatch: true },
      { title: 'Fitness', path: '/parent/tracker/fitness', icon: Activity, roles: ['parent', 'guardian'], strictRoleMatch: true },
      { title: 'Workout list', path: '/parent/tracker/workouts', icon: Dumbbell, roles: ['parent', 'guardian'], strictRoleMatch: true },
      { title: 'Skill assessment', path: '/parent/tracker/skill-assessment', icon: Award, roles: ['parent', 'guardian'], strictRoleMatch: true },
      { title: 'Height / Weight', path: '/parent/tracker/height-weight', icon: Ruler, roles: ['parent', 'guardian'], strictRoleMatch: true },
    ],
  },
  {
    title: 'Send Feedback',
    icon: MessageSquare,
    path: '/parent/feedback',
    roles: ['parent', 'guardian'],
    strictRoleMatch: true,
  },
];

export const MENU_SIDEBAR_CUSTOM: MenuConfig = [
  {
    title: 'Store - Client',
    icon: Users,
    path:'/'
  },
];

export const MENU_SIDEBAR_COMPACT: MenuConfig = [
  {
    title: 'Dashboards',
    icon: LayoutGrid,
    path: '/dashboard/batch',
    roles: ['admin', 'manager'],
  },
  {
    title: 'Public Profile',
    icon: UserCircle,
    roles: ['admin', 'manager'],
    children: [
      {
        title: 'Profiles',
        path: '/public-profile/profiles/company'
      },
      {
        title: 'Projects',
        children: [
          { title: '3 Columns', path: '/public-profile/projects/3-columns' },
          { title: '2 Columns', path: '/public-profile/projects/2-columns' },
        ],
      },
      { title: 'Teams', path: '/public-profile/teams' },    
    ],
  },
  
  {
    title: 'User Management',
    icon: ShieldUser,
    roles: ['admin', 'manager'],
    children: [
      {
        title: 'Users',
        path: '/user-management/users',
      },
      {
        title: 'Roles',
        path: '/user-management/roles',
      },
      {
        title: 'Permissions',
        path: '/user-management/permissions',
      },
      {
        title: 'Account',
        path: '/user-management/account',
      },
      {
        title: 'Logs',
        path: '/user-management/logs',
      },
      {
        title: 'Settings',
        path: '/user-management/settings',
      },
    ],
  },
 
];

export const MENU_MEGA: MenuConfig = [
  { title: 'Home', path: '/' },
  {
    title: 'Profiles',
    roles: ['admin', 'manager'],
    children: [
      {
        title: 'Profiles',
        path: '/public-profile/profiles/company',
      },
      
    ],
  },
 
  {
    title: 'Apps',
    roles: ['owner','admin', 'manager'],
    children: [
      {
        title: 'User Management',
        children: [
          {
            children: [
              {
                title: 'Users',
                path: '/user-management/users',
              },
              {
                title: 'Roles',
                path: '/user-management/roles',
              },
              {
                title: 'Permissions',
                path: '/user-management/permissions',
              },
              {
                title: 'Account',
                path: '/user-management/account',
              },
              {
                title: 'Logs',
                path: '/user-management/logs',
              },
              {
                title: 'Settings',
                path: '/user-management/settings',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const MENU_MEGA_MOBILE: MenuConfig = [
  { title: 'Home', path: '/',roles: ['owner','admin', 'manager'], },
  {
    title: 'Profiles',
    roles: ['owner','admin', 'manager'],
    path: '/public-profile/profiles/company',
  },
  {
    title: 'My Account',
    roles: ['owner','admin', 'manager'],
    children: [
      {
        title: 'General Pages',
        children: [
          { title: 'Integrations', icon: Plug, path: '/account/integrations' },
          {
            title: 'Notifications',
            icon: Bell,
            path: '/account/notifications',
          },
          { title: 'API Keys', icon: Key, path: '/account/api-keys' },
          { title: 'Appearance', icon: Eye, path: '/account/appearance' },
          {
            title: 'Invite a Friend',
            icon: UserCheck,
            path: '/account/invite-a-friend',
          },
          { title: 'Activity', icon: LifeBuoy, path: '/account/activity' },
          { title: 'Brand', icon: CheckCircle, disabled: true },
          { title: 'Get Paid', icon: Euro, disabled: true },
        ],
      },
      {
        title: 'Other pages',
        children: [
          {
            title: 'Account Home',
            children: [
              { title: 'Get Started', path: '/account/home/get-started' },
              { title: 'User Profile', path: '/account/home/user-profile' },
              {
                title: 'Company Profile',
                path: '/account/home/company-profile',
              },
              { title: 'With Sidebar', path: '/account/home/settings-sidebar' },
              {
                title: 'Enterprise',
                path: '/account/home/settings-enterprise',
              },
            ],
          },
          {
            title: 'Billing',
            children: [
              { title: 'Basic Billing', path: '/account/billing/basic' },
              { title: 'Enterprise', path: '/account/billing/enterprise' },
              { title: 'Plans', path: '/account/billing/plans' },
              { title: 'Billing History', path: '/account/billing/history' },
              { title: 'Tax Info', disabled: true },
              { title: 'Invoices', disabled: true },
              { title: 'Gateaways', disabled: true },
            ],
          },
          {
            title: 'Security',
            children: [
              { title: 'Get Started', path: '/account/security/get-started' },
              {
                title: 'Security Overview',
                path: '/account/security/overview',
              },
              {
                title: 'IP Addresses',
                path: '/account/security/allowed-ip-addresses',
              },
              {
                title: 'Privacy Settings',
                path: '/account/security/privacy-settings',
              },
              {
                title: 'Device Management',
                path: '/account/security/device-management',
              },
              {
                title: 'Backup & Recovery',
                path: '/account/security/backup-and-recovery',
              },
              {
                title: 'Current Sessions',
                path: '/account/security/current-sessions',
              },
              { title: 'Security Log', path: '/account/security/security-log' },
            ],
          },
          {
            title: 'Members & Roles',
            children: [
              { title: 'Teams Starter', path: '/account/members/team-starter' },
              { title: 'Teams', path: '/account/members/teams' },
              { title: 'Team Info', path: '/account/members/team-info' },
              {
                title: 'Members Starter',
                path: '/account/members/members-starter',
              },
              { title: 'Team Members', path: '/account/members/team-members' },
              {
                title: 'Import Members',
                path: '/account/members/import-members',
              },
              { title: 'Roles', path: '/account/members/roles' },
              {
                title: 'Permissions - Toggler',
                path: '/account/members/permissions-toggle',
              },
              {
                title: 'Permissions - Check',
                path: '/account/members/permissions-check',
              },
            ],
          },
          {
            title: 'Other Pages',
            children: [
              { title: 'Integrations', path: '/account/integrations' },
              { title: 'Notifications', path: '/account/notifications' },
              { title: 'API Keys', path: '/account/api-keys' },
              { title: 'Appearance', path: '/account/appearance' },
              { title: 'Invite a Friend', path: '/account/invite-a-friend' },
              { title: 'Activity', path: '/account/activity' },
            ],
          },
        ],
      },
    ],
  },
 
  {
    title: 'User Management',
    icon: Users,
    roles: ['owner','admin', 'manager'],
    children: [
      {
        title: 'Users',
        path: '/user-management/users',
      },
      {
        title: 'Roles',
        path: '/user-management/roles',
      },
      {
        title: 'Permissions',
        path: '/user-management/permissions',
      },
      {
        title: 'Account',
        path: '/user-management/account',
      },
      {
        title: 'Logs',
        path: '/user-management/logs',
      },
      {
        title: 'Settings',
        path: '/user-management/settings',
      },
    ],
  }, 
];

export const MENU_HELP: MenuConfig = [
  { separator: true },
  { title: 'Contact Us', icon: Share2, path: 'https://example.com/contact' },
];

export const MENU_ROOT: MenuConfig = [
  {
    title: 'Public Profile',
    icon: UserCircle,
    rootPath: '/public-profile/',
    path: '/public-profile/profiles/default',
    childrenIndex: 2,
  },
  
  {
    title: 'User Management',
    icon: ShieldUser,
    rootPath: '/user-management/',
    path: '/user-management/users',
    childrenIndex: 7,
  },
];
export const MENU_DASHBOARD: MenuConfig = [
  {
    title: 'Demographics',
    icon: UserCircle,
    rootPath: '/admin/dashboard/',
    path: '/admin/dashboard/gymnasts',
    childrenIndex: 1,
    roles: ['owner','admin', 'manager'],
  },
  {
    title: 'Batch & Enrollment',
    icon: Users,
    rootPath: '/dashboard/',
    path: '/admin/dashboard/batch',
    childrenIndex: 2,
    roles: ['owner','admin', 'manager'],
  },
  {
    title: 'Growth & Retention',
    icon: Settings,
    rootPath: '/dashboard/',
    path: '/admin/dashboard/growth',
    childrenIndex: 3,
    roles: ['owner','admin', 'manager'],
  },
  
  {
    title: 'Attendance & Engagement',
    icon: Shield,
    rootPath: '/dashboard/',
    path: '/admin/dashboard/attendance',
    childrenIndex: 4,
    roles: ['owner','admin', 'manager'],
  },
  {
    title: 'Financial',
    icon: Shield,
    rootPath: '/dashboard/',
    path: '/admin/dashboard/finance',
    childrenIndex: 5,
    roles: ['owner','admin', 'manager'],
  },
  {
    title: 'Operational KPIs',
    icon: ShoppingCart,
    rootPath: '/dashboard/',
    path: '/admin/dashboard/batch',
    childrenIndex: 6,
    roles: ['owner','admin', 'manager'],
  },
];