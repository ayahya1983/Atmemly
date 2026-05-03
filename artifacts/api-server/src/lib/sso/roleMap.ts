/**
 * ATMEMLY SSO role-mapping evaluator.
 *
 * `roleMappingJson` shape (configured per provider in admin UI):
 *
 *   {
 *     "rules": [
 *       { "claim": "email", "matches": "*@atmemly.com", "role": "admin", "adminRole": "super_admin" },
 *       { "claim": "groups", "contains": "atmemly-finance", "role": "admin", "adminRole": "finance_admin" },
 *       { "claim": "realm_access.roles", "contains": "freelancer", "role": "freelancer" }
 *     ],
 *     "default": { "role": "client" }
 *   }
 *
 * Supported claim paths:
 *  - dotted paths like `realm_access.roles`, `resource_access.atmemly.roles`, `groups`
 *  - plain top-level claim names like `email`, `preferred_username`
 *
 * Operators: `matches` (glob with *), `contains` (claim must be array containing value),
 *            `equals` (exact string match).
 *
 * Security: this evaluator NEVER promotes a user to the `admin` role unless an
 * explicit rule says so. Untrusted claims cannot escalate.
 */

import { ADMIN_ROLES, type AdminRole } from "../permissions";

export interface RoleMapRule {
  claim: string;
  matches?: string;
  contains?: string;
  equals?: string;
  role?: string;
  adminRole?: string;
}

export interface RoleMapConfig {
  rules?: RoleMapRule[];
  default?: { role?: string; adminRole?: string };
}

export interface MappedRoles {
  role: string; // public role: client | freelancer | admin
  adminRole: AdminRole | null;
}

export const PUBLIC_ROLES = ["client", "freelancer", "admin"] as const;

function getClaim(claims: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = claims;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function globMatch(value: string, pattern: string): boolean {
  // Simple glob: '*' = .*; everything else literal.
  const escaped = pattern
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const re = new RegExp(`^${escaped}$`, "i");
  return re.test(value);
}

function ruleMatches(rule: RoleMapRule, claims: Record<string, unknown>): boolean {
  const claimValue = getClaim(claims, rule.claim);
  if (claimValue === undefined || claimValue === null) return false;
  if (rule.equals !== undefined) {
    return String(claimValue) === rule.equals;
  }
  if (rule.matches !== undefined) {
    if (typeof claimValue !== "string") return false;
    return globMatch(claimValue, rule.matches);
  }
  if (rule.contains !== undefined) {
    if (!Array.isArray(claimValue)) return false;
    return claimValue.some((v) => String(v) === rule.contains);
  }
  return false;
}

function sanitizeRole(role: string | undefined): string | null {
  if (!role) return null;
  if ((PUBLIC_ROLES as readonly string[]).includes(role)) return role;
  return null;
}

function sanitizeAdminRole(adminRole: string | undefined): AdminRole | null {
  if (!adminRole) return null;
  if ((ADMIN_ROLES as readonly string[]).includes(adminRole)) {
    return adminRole as AdminRole;
  }
  return null;
}

export function evaluateRoleMapping(
  config: unknown,
  claims: Record<string, unknown>,
  fallbackRole: string,
): MappedRoles {
  const cfg = (config && typeof config === "object" ? (config as RoleMapConfig) : {}) || {};
  const rules = Array.isArray(cfg.rules) ? cfg.rules : [];
  for (const rule of rules) {
    if (ruleMatches(rule, claims)) {
      const role = sanitizeRole(rule.role) ?? fallbackRole;
      const adminRole = role === "admin" ? sanitizeAdminRole(rule.adminRole) : null;
      return { role, adminRole };
    }
  }
  const dflt = cfg.default ?? {};
  const role = sanitizeRole(dflt.role) ?? fallbackRole;
  const adminRole = role === "admin" ? sanitizeAdminRole(dflt.adminRole) : null;
  return { role, adminRole };
}
