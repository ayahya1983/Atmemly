import type { Request, Response, NextFunction } from "express";

// Phase 6 — granular admin role/permission system.
//
// `role` on users is the public role (client | freelancer | admin).
// `adminRole` is the staff sub-role used for permission gating in the admin panel.
// A user is considered "admin staff" iff `role === 'admin'`. The `adminRole` then
// determines which resources/actions they may perform. Legacy `role === 'admin'`
// users without an explicit `adminRole` are treated as `'admin'` (matrix-driven,
// NOT super_admin) — least privilege. Unknown adminRole values fail closed (deny).
// To grant super_admin, set `adminRole='super_admin'` explicitly (the seed does
// this for the canonical `admin@khidma.ae` account).

export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "moderator",
  "finance_admin",
  "content_manager",
  "support_agent",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

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

// Permission matrix. Each (resource, action) lists the admin roles allowed.
// `super_admin` is implicitly allowed everywhere via the gate logic — listing
// it here would just be noise.
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

export function effectiveAdminRole(user: {
  role: string;
  adminRole: string | null | undefined;
}): AdminRole | null {
  if (user.role !== "admin") return null;
  // Legacy admin (no explicit adminRole) → treat as standard 'admin', NOT
  // super_admin. The matrix below grants 'admin' broad write access but not
  // a blanket bypass.
  if (!user.adminRole) return "admin";
  if ((ADMIN_ROLES as readonly string[]).includes(user.adminRole)) {
    return user.adminRole as AdminRole;
  }
  // Unknown adminRole on an admin user — fail closed: deny everything.
  return null;
}

export function hasPermission(
  user: { role: string; adminRole: string | null | undefined } | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!user) return false;
  const role = effectiveAdminRole(user);
  if (role === null) return false;
  if (role === "super_admin") return true;
  const allowed = PERMISSIONS[resource][action];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function requirePermission(resource: Resource, action: Action) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!hasPermission(req.user, resource, action)) {
      res.status(403).json({ error: "forbidden", resource, action });
      return;
    }
    next();
  };
}
