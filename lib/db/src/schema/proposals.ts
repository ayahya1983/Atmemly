import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";

export const proposalsTable = pgTable(
  "proposals",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    coverLetter: text("cover_letter").notNull(),
    expectedRate: numeric("expected_rate", { precision: 12, scale: 2 }).notNull(),
    deliveryDays: integer("delivery_days").notNull(),
    portfolioLinks: text("portfolio_links").array().notNull().default([]),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026)
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    jobIdx: index("proposals_job_idx").on(t.jobId),
    freelancerIdx: index("proposals_freelancer_idx").on(t.freelancerId),
    statusIdx: index("proposals_status_idx").on(t.status),
    deletedIdx: index("proposals_deleted_idx").on(t.deletedAt),
    // ATMEMLY audit (May 2026) — "show me pending proposals on job X" is the
    // hottest path for both the client dashboard and admin moderation queue.
    jobStatusIdx: index("proposals_job_status_idx").on(t.jobId, t.status),
  }),
);

export type Proposal = typeof proposalsTable.$inferSelect;
