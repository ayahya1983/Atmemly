import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: text("role").notNull(),
    // Phase 6 — granular admin sub-role for staff users.
    // Values: super_admin | admin | moderator | finance_admin | content_manager | support_agent
    // NULL = not staff. Independent of `role` so both gates can be enforced.
    adminRole: text("admin_role"),
    status: text("status").notNull().default("active"),
    avatarUrl: text("avatar_url"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastLoginIp: text("last_login_ip"),
    lastLoginUa: text("last_login_ua"),
    phone: text("phone"),
    country: text("country"),
    city: text("city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026) — track row updates for cache invalidation, ETags, list ordering.
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026) — soft-delete: never hard-delete users (FK history, payments, audit).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index("users_status_idx").on(t.status),
    deletedIdx: index("users_deleted_idx").on(t.deletedAt),
    // ATMEMLY audit (May 2026) — admin people pages always filter by role
    // (client / freelancer / admin) and order by createdAt DESC.
    roleCreatedIdx: index("users_role_created_idx").on(t.role, t.createdAt),
  }),
);

export type User = typeof usersTable.$inferSelect;
