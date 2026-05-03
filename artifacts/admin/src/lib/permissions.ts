// Mirror of the server-side permission matrix, used for client-side gating.
// Authoritative source: artifacts/api-server/src/lib/permissions.ts.
// The server still enforces every permission — this is purely for UI affordances
// (sidebar visibility, action button gating).

export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "finance_admin",
  "content_manager",
  "support_agent",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, { en: string; ar: string }> = {
  super_admin: { en: "Super Admin", ar: "مدير عام" },
  admin: { en: "Admin", ar: "مشرف" },
  moderator: { en: "Moderator", ar: "مشرف محتوى" },
  finance_admin: { en: "Finance Admin", ar: "مشرف مالي" },
  content_manager: { en: "Content Manager", ar: "مدير محتوى" },
  support_agent: { en: "Support Agent", ar: "وكيل دعم" },
};

export type Resource =
  | "dashboard"
  | "users"
  | "freelancers"
  | "clients"
  | "verifications"
  | "jobs"
  | "services"
  | "proposals"
  | "contracts"
  | "milestones"
  | "payments"
  | "escrow"
  | "payouts"
  | "disputes"
  | "complaints"
  | "reviews"
  | "categories"
  | "skills"
  | "cms"
  | "blog"
  | "faqs"
  | "testimonials"
  | "notifications"
  | "localization"
  | "settings"
  | "seo"
  | "moderation"
  | "reports"
  | "audit_logs"
  | "admin_users";

export type Action = "read" | "write" | "delete" | "approve";

const PERMISSIONS: Record<Resource, Partial<Record<Action, AdminRole[]>>> = {
  dashboard: {
    read: ["admin", "moderator", "finance_admin", "content_manager", "support_agent"],
  },
  users: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "support_agent"],
    delete: ["admin"],
  },
  freelancers: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "moderator"],
    approve: ["admin", "moderator"],
  },
  clients: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "support_agent"],
    approve: ["admin", "moderator"],
  },
  verifications: {
    read: ["admin", "moderator", "support_agent"],
    approve: ["admin", "moderator"],
  },
  jobs: {
    read: ["admin", "moderator", "support_agent", "content_manager"],
    write: ["admin", "moderator"],
    approve: ["admin", "moderator"],
    delete: ["admin", "moderator"],
  },
  services: {
    read: ["admin", "moderator", "content_manager"],
    write: ["admin", "moderator"],
    approve: ["admin", "moderator"],
    delete: ["admin", "moderator"],
  },
  proposals: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "moderator"],
  },
  contracts: {
    read: ["admin", "support_agent", "finance_admin"],
    write: ["admin"],
  },
  milestones: {
    read: ["admin", "support_agent", "finance_admin"],
    write: ["admin"],
  },
  payments: {
    read: ["admin", "finance_admin", "support_agent"],
    write: ["admin", "finance_admin"],
    approve: ["admin", "finance_admin"],
  },
  escrow: {
    read: ["admin", "finance_admin"],
    write: ["admin", "finance_admin"],
  },
  payouts: {
    read: ["admin", "finance_admin"],
    write: ["admin", "finance_admin"],
    approve: ["admin", "finance_admin"],
  },
  disputes: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "moderator"],
  },
  complaints: {
    read: ["admin", "moderator", "support_agent"],
    write: ["admin", "moderator", "support_agent"],
  },
  reviews: {
    read: ["admin", "moderator", "content_manager"],
    write: ["admin", "moderator"],
    delete: ["admin", "moderator"],
  },
  categories: {
    read: ["admin", "moderator", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  skills: {
    read: ["admin", "moderator", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  cms: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  blog: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  faqs: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  testimonials: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
    delete: ["admin", "content_manager"],
  },
  notifications: {
    read: ["admin", "content_manager", "support_agent"],
    write: ["admin", "content_manager"],
  },
  localization: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
  },
  settings: {
    read: ["admin", "finance_admin"],
    write: ["admin"],
  },
  seo: {
    read: ["admin", "content_manager"],
    write: ["admin", "content_manager"],
  },
  moderation: {
    read: ["admin", "moderator"],
    write: ["admin", "moderator"],
  },
  reports: {
    read: ["admin", "finance_admin"],
  },
  audit_logs: {
    read: ["admin", "finance_admin", "moderator"],
  },
  admin_users: {
    read: ["admin"],
    write: ["admin"],
    delete: ["admin"],
  },
};

export function effectiveAdminRole(
  user: { role: string; adminRole?: string | null } | null | undefined,
): AdminRole | null {
  if (!user) return null;
  if (user.role !== "admin") return null;
  // Legacy admin (no explicit adminRole) → super_admin, mirroring the server.
  if (!user.adminRole) return "super_admin";
  if ((ADMIN_ROLES as readonly string[]).includes(user.adminRole)) {
    return user.adminRole as AdminRole;
  }
  return null;
}

export function hasPermission(
  user: { role: string; adminRole?: string | null } | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  const role = effectiveAdminRole(user);
  if (role === null) return false;
  if (role === "super_admin") return true;
  const allowed = PERMISSIONS[resource][action];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function isAdminStaff(
  user: { role: string; adminRole?: string | null } | null | undefined,
): boolean {
  return effectiveAdminRole(user) !== null;
}
