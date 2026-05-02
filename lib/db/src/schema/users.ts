import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
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
});

export type User = typeof usersTable.$inferSelect;
