import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const milestonesTable = pgTable(
  "milestones",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("AED"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: text("status").notNull().default("pending_funding"),
    escrowState: text("escrow_state").notNull().default("none"),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    paymentId: integer("payment_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contractIdx: index("milestones_contract_idx").on(t.contractId),
    statusIdx: index("milestones_status_idx").on(t.status),
  }),
);

export type Milestone = typeof milestonesTable.$inferSelect;
