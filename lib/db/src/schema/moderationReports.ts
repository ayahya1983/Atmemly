import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const moderationReportsTable = pgTable(
  "moderation_reports",
  {
    id: serial("id").primaryKey(),
    targetKind: text("target_kind").notNull(),
    targetId: integer("target_id").notNull(),
    reporterUserId: integer("reporter_user_id"),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("pending"),
    action: text("action"),
    reviewedById: integer("reviewed_by_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("moderation_reports_status_idx").on(t.status),
    targetIdx: index("moderation_reports_target_idx").on(t.targetKind, t.targetId),
    reporterIdx: index("moderation_reports_reporter_idx").on(t.reporterUserId),
  }),
);

export type ModerationReport = typeof moderationReportsTable.$inferSelect;
