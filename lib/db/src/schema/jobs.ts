import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const jobsTable = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categorySlug: text("category_slug").notNull(),
    budgetType: text("budget_type").notNull(),
    budgetMin: numeric("budget_min", { precision: 12, scale: 2 }).notNull().default("0"),
    budgetMax: numeric("budget_max", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("AED"),
    skills: text("skills").array().notNull().default([]),
    status: text("status").notNull().default("open"),
    deadline: timestamp("deadline", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusCreatedIdx: index("jobs_status_created_idx").on(t.status, t.createdAt),
    categoryIdx: index("jobs_category_idx").on(t.categorySlug),
  }),
);

export type Job = typeof jobsTable.$inferSelect;
