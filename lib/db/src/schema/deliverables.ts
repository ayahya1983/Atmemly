import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const deliverablesTable = pgTable(
  "deliverables",
  {
    id: serial("id").primaryKey(),
    milestoneId: integer("milestone_id").notNull(),
    freelancerId: integer("freelancer_id").notNull(),
    message: text("message").notNull().default(""),
    files: text("files").array().notNull().default([]),
    revisionNumber: integer("revision_number").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milestoneIdx: index("deliverables_milestone_idx").on(t.milestoneId),
  }),
);

export type Deliverable = typeof deliverablesTable.$inferSelect;
