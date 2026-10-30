/**
 * Centralized API paths for frontend API calls.
 * Import from here instead of hardcoding paths in components.
 *
 * For dynamic paths (e.g. /api/student/:id), use the helper functions.
 * For paths with query params, append them: `${API_PATHS.student.list}?${params}`
 */

const API_BASE = '/api';

/** Build path with optional query string */
export function withParams(base: string, params?: string | URLSearchParams): string {
  if (!params) return base;
  const qs = typeof params === 'string' ? params : params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── Common / Select endpoints ─────────────────────────────────────────────
export const API_PATHS = {
  // Select dropdowns (used across admin/manager/coach)
  location: {
    select: `${API_BASE}/location/select`,
    selectActive: `${API_BASE}/location/select?status=ACTIVE`,
    selectActiveAlt: `${API_BASE}/location/select?active=true`,
    delete: `${API_BASE}/location/delete`,
  },
  student: {
    list: `${API_BASE}/student`,
    byId: (id: string) => `${API_BASE}/student/${id}`,
    select: `${API_BASE}/student/select`,
    documents: (studentId: string) => `${API_BASE}/student/${studentId}/documents`,
    documentDelete: (studentId: string, documentId: string) =>
      `${API_BASE}/student/${studentId}/documents?documentId=${documentId}`,
    siblings: `${API_BASE}/student/siblings`,
    sibling: `${API_BASE}/student/sibling`,
    sendEmail: `${API_BASE}/student/send-email`,
    sendLoginDetails: `${API_BASE}/student/send-login-details`,
  },
  program: {
    list: `${API_BASE}/program`,
    select: `${API_BASE}/program/select`,
    delete: `${API_BASE}/program/delete`,
  },
  course: {
    list: `${API_BASE}/course`,
    byId: (id: string) => `${API_BASE}/course/${id}`,
    select: `${API_BASE}/course/select`,
    delete: `${API_BASE}/course/delete`,
  },
  employee: {
    list: `${API_BASE}/employee`,
    byId: (id: string) => `${API_BASE}/employee/${id}`,
    select: `${API_BASE}/employee/select`,
    delete: `${API_BASE}/employee/delete`,
  },
  skillLevel: {
    select: `${API_BASE}/skill-level/select`,
  },
  apparatus: {
    select: `${API_BASE}/apparatus/select?active=true`,
  },
  team: {
    list: `${API_BASE}/team`,
    byId: (id: string) => `${API_BASE}/team/${id}`,
    select: `${API_BASE}/team/select`,
    delete: `${API_BASE}/team/delete`,
  },
  subscriptionPlans: {
    select: `${API_BASE}/subscription-plans/select`,
  },

  // Administration
  administration: {
    sportsCategories: {
      list: `${API_BASE}/administration/sports-categories`,
      byId: (id: string) => `${API_BASE}/administration/sports-categories/${id}`,
      select: `${API_BASE}/administration/sports-categories/select`,
      delete: `${API_BASE}/administration/sports-categories/delete`,
    },
    fitnessCategories: {
      list: `${API_BASE}/administration/fitness-categories`,
      byId: (id: string) => `${API_BASE}/administration/fitness-categories/${id}`,
      select: `${API_BASE}/administration/fitness-categories/select`,
    },
    fitnessGradingCriteria: {
      list: `${API_BASE}/administration/fitness-grading-criteria`,
      byId: (id: string) => `${API_BASE}/administration/fitness-grading-criteria/${id}`,
    },
    skilllevel: {
      list: `${API_BASE}/administration/skilllevel`,
      byId: (id: string) => `${API_BASE}/administration/skilllevel/${id}`,
      select: `${API_BASE}/administration/skilllevel/select`,
      delete: `${API_BASE}/administration/skilllevel/delete`,
    },
  },

  // Batch
  batch: {
    list: `${API_BASE}/batch`,
    byId: (id: string) => `${API_BASE}/batch/${id}`,
    delete: `${API_BASE}/batch/delete`,
  },

  // Manager-specific
  manager: {
    dashboard: `${API_BASE}/manager/dashboard`,
    students: {
      list: `${API_BASE}/manager/students`,
      byId: (id: string) => `${API_BASE}/manager/students/${id}`,
      select: `${API_BASE}/manager/students/select`,
      siblings: `${API_BASE}/manager/students/siblings`,
      sibling: `${API_BASE}/manager/students/sibling`,
    },
    batch: {
      list: `${API_BASE}/manager/batch`,
      byId: (id: string) => `${API_BASE}/manager/batch/${id}`,
    },
    course: {
      select: `${API_BASE}/manager/course/select`,
    },
    employee: {
      select: `${API_BASE}/manager/employee/select`,
    },
    trial: {
      list: `${API_BASE}/manager/trial`,
      byId: (id: string) => `${API_BASE}/manager/trial/${id}`,
      delete: `${API_BASE}/manager/trial/delete`,
    },
    gymnastManagement: {
      attendance: `${API_BASE}/manager/gymnast-management/attendance`,
      inactive: `${API_BASE}/manager/gymnast-management/inactive`,
      birthdays: `${API_BASE}/manager/gymnast-management/birthdays`,
    },
    fees: {
      payments: {
        list: `${API_BASE}/manager/fees/payments`,
        byId: (id: string) => `${API_BASE}/manager/fees/payments/${id}`,
      },
      invoice: {
        list: `${API_BASE}/manager/fees/invoice`,
        byId: (id: string) => `${API_BASE}/manager/fees/invoice/${id}`,
        generate: `${API_BASE}/manager/fees/invoice/generate`,
      },
    },
  },

  // Coach-specific
  coach: {
    students: `${API_BASE}/coach/students`,
    gymnastManagement: {
      attendance: `${API_BASE}/coach/gymnast-management/attendance`,
    },
  },

  // Owner-specific
  owner: {
    dashboard: `${API_BASE}/owner/dashboard`,
    tenants: `${API_BASE}/owner/tenants`,
    students: `${API_BASE}/owner/students`,
    locations: {
      select: `${API_BASE}/owner/locations/select?active=true`,
      selectWithTenant: (tenantId: string) => `${API_BASE}/owner/locations/select?active=true&tenantId=${tenantId}`,
    },
    reports: {
      centerPerformance: `${API_BASE}/owner/reports/center-performance`,
      charts: `${API_BASE}/owner/reports/charts`,
    },
    skills: {
      list: `${API_BASE}/owner/skills`,
      byId: (id: string) => `${API_BASE}/owner/skills/${id}`,
      delete: `${API_BASE}/owner/skills/delete`,
    },
  },

  // Tenant
  tenant: {
    switch: `${API_BASE}/tenant/switch`,
  },
  tenantManagement: {
    list: `${API_BASE}/tenant-management`,
    byId: (id: string) => `${API_BASE}/tenant-management/${id}`,
    select: `${API_BASE}/tenant-management/select?active=true`,
    sendWelcomeEmail: (id: string) => `${API_BASE}/tenant-management/${id}/send-welcome-email`,
    delete: `${API_BASE}/tenant-management/delete`,
  },

  // Event management
  eventManagement: {
    events: {
      list: `${API_BASE}/event-management/events`,
      byId: (id: string) => `${API_BASE}/event-management/events/${id}`,
      select: `${API_BASE}/event-management/events/select`,
      delete: `${API_BASE}/event-management/events/delete`,
    },
    registerGymnast: {
      list: `${API_BASE}/event-management/register-gymnast`,
      byId: (id: string) => `${API_BASE}/event-management/register-gymnast/${id}`,
      details: `${API_BASE}/event-management/register-gymnast/details`,
    },
  },

  // Skills assessment
  skillsAssessment: {
    skills: `${API_BASE}/skills-assessment/skills`,
    submit: `${API_BASE}/skills-assessment/submit`,
    assessment: {
      list: `${API_BASE}/skills-assessment/assessment`,
      result: `${API_BASE}/skills-assessment/assessment/result`,
      graphData: `${API_BASE}/skills-assessment/assessment/graph-data`,
      teamAverage: `${API_BASE}/skills-assessment/assessment/team-average`,
      pastResults: `${API_BASE}/skills-assessment/assessment/past-results`,
      comments: `${API_BASE}/skills-assessment/assessment/comments`,
    },
  },

  // Fitness assessment (event type fitness-assessment)
  fitnessAssessment: {
    skills: `${API_BASE}/fitness-assessment/skills`,
    submit: `${API_BASE}/fitness-assessment/submit`,
    assessment: {
      list: `${API_BASE}/fitness-assessment/assessment`,
      result: `${API_BASE}/fitness-assessment/assessment/result`,
      graphData: `${API_BASE}/fitness-assessment/assessment/graph-data`,
      teamAverage: `${API_BASE}/fitness-assessment/assessment/team-average`,
      pastResults: `${API_BASE}/fitness-assessment/assessment/past-results`,
      comments: `${API_BASE}/fitness-assessment/assessment/comments`,
    },
  },

  // Skills (admin)
  skills: {
    list: `${API_BASE}/skills`,
    byId: (id: string) => `${API_BASE}/skills/${id}`,
    delete: `${API_BASE}/skills/delete`,
  },

  // Trial
  trial: {
    list: `${API_BASE}/trial`,
    byId: (id: string) => `${API_BASE}/trial/${id}`,
    delete: `${API_BASE}/trial/delete`,
  },

  // Gymnast management (admin)
  gymnastManagement: {
    attendance: `${API_BASE}/gymnast-management/attendance`,
    attendanceBatches: `${API_BASE}/gymnast-management/attendance/batches`,
    birthdays: `${API_BASE}/gymnast-management/birthdays`,
    inactive: `${API_BASE}/gymnast-management/inactive`,
  },

  // Fees
  fees: {
    invoice: {
      list: `${API_BASE}/fees/invoice`,
      byId: (id: string) => `${API_BASE}/fees/invoice/${id}`,
      generate: `${API_BASE}/fees/invoice/generate`,
    },
    payments: {
      list: `${API_BASE}/fees/payments`,
      byId: (id: string) => `${API_BASE}/fees/payments/${id}`,
    },
  },

  // Reports
  reports: {
    attendance: {
      student: `${API_BASE}/reports/attendance/student`,
    },
  },

  // Dashboard
  dashboard: {
    kpi: `${API_BASE}/dashboard/kpi`,
    earnings: `${API_BASE}/dashboard/earnings`,
    growth: `${API_BASE}/dashboard/growth`,
    enrollment: `${API_BASE}/dashboard/enrollment`,
    finance: `${API_BASE}/dashboard/finance`,
    batch: `${API_BASE}/dashboard/batch`,
    attendance: `${API_BASE}/dashboard/attendance`,
  },

  // Parent portal
  parent: {
    children: `${API_BASE}/parent/children`,
    dashboard: `${API_BASE}/parent/dashboard`,
    tracker: {
      attendance: `${API_BASE}/parent/tracker/attendance`,
      fitness: `${API_BASE}/parent/tracker/fitness`,
      fitnessAssessment: `${API_BASE}/parent/tracker/fitness-assessment`,
      workouts: `${API_BASE}/parent/tracker/workouts`,
      skillAssessment: `${API_BASE}/parent/tracker/skill-assessment`,
      heightWeight: `${API_BASE}/parent/tracker/height-weight`,
    },
    youtubeVideos: `${API_BASE}/parent/youtube-videos`,
  },

  // Parent feedback / messages to admin-manager-coach
  feedback: {
    list: `${API_BASE}/feedback`,
    byId: (id: string) => `${API_BASE}/feedback/${id}`,
    reply: (id: string) => `${API_BASE}/feedback/${id}/reply`,
    notifications: {
      list: `${API_BASE}/feedback/notifications`,
      count: `${API_BASE}/feedback/notifications/count`,
      read: `${API_BASE}/feedback/notifications/read`,
    },
  },

  /** Current session user profile (all authenticated tenant roles) */
  me: {
    profile: `${API_BASE}/me/profile`,
  },

  // Auth
  auth: {
    signup: `${API_BASE}/auth/signup`,
    verifyEmail: `${API_BASE}/auth/verify-email`,
    resetPassword: `${API_BASE}/auth/reset-password`,
    resetPasswordVerify: `${API_BASE}/auth/reset-password-verify`,
    changePassword: `${API_BASE}/auth/change-password`,
  },

  // User management
  userManagement: {
    users: `${API_BASE}/user-management/users`,
    userById: (id: string) => `${API_BASE}/user-management/users/${id}`,
    userRestore: (id: string) => `${API_BASE}/user-management/users/${id}/restore`,
    settings: `${API_BASE}/user-management/settings`,
    settingsGeneral: `${API_BASE}/user-management/settings/general`,
    roles: {
      list: `${API_BASE}/user-management/roles`,
      byId: (id: string) => `${API_BASE}/user-management/roles/${id}`,
      select: `${API_BASE}/user-management/roles/select`,
      default: (id: string) => `${API_BASE}/user-management/roles/${id}/default`,
    },
    permissions: {
      list: `${API_BASE}/user-management/permissions`,
      byId: (id: string) => `${API_BASE}/user-management/permissions/${id}`,
      select: `${API_BASE}/user-management/permissions/select`,
      delete: `${API_BASE}/user-management/permissions/delete`,
    },
    account: `${API_BASE}/user-management/account/`,
    accountProfile: `${API_BASE}/user-management/account/profile`,
    accountChangeEmail: `${API_BASE}/user-management/account/change-email`,
  },

  /** Public parent-facing student registration (no auth; scoped by academy code in path) */
  publicStudentRegister: {
    meta: (academyCode: string) =>
      `${API_BASE}/public/student-register/${encodeURIComponent(academyCode)}`,
    submit: (academyCode: string) =>
      `${API_BASE}/public/student-register/${encodeURIComponent(academyCode)}`,
    upload: (academyCode: string) =>
      `${API_BASE}/public/student-register/${encodeURIComponent(academyCode)}/upload`,
  },

  // Upload
  upload: `${API_BASE}/upload`,
} as const;
