import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Dedicated SSO/login audit trail. Separate from the generic
 * `audit_logs` so admins can filter and report on sign-in activity
 * without scanning every CRUD action.
 *
 * `outcome` values: success | failure | needs_linking | provisioned |
 * link | unlink | provider_change | denied
 */
export const loginAuditLogsTable = pgTable(
  "login_audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    providerId: integer("provider_id"),
    providerSlug: text("provider_slug"),
    email: text("email"),
    action: text("action").notNull(),
    outcome: text("outcome").notNull(),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("login_audit_logs_user_idx").on(t.userId),
    providerIdx: index("login_audit_logs_provider_idx").on(t.providerId),
    outcomeIdx: index("login_audit_logs_outcome_idx").on(t.outcome),
    createdIdx: index("login_audit_logs_created_idx").on(t.createdAt),
  }),
);

export type LoginAuditLog = typeof loginAuditLogsTable.$inferSelect;
