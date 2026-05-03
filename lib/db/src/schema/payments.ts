import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";
import { contractsTable } from "./contracts";
import { milestonesTable } from "./milestones";

export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "restrict" }),
    payerId: integer("payer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    payeeId: integer("payee_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
    milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    platformFeeAmount: numeric("platform_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    freelancerNetAmount: numeric("freelancer_net_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("pending"),
    invoiceNumber: text("invoice_number").notNull(),
    stripeIntentId: text("stripe_intent_id"),
    heldAt: timestamp("held_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Architecture audit (May 2026) — high-traffic admin/list queries.
    jobIdx: index("payments_job_idx").on(t.jobId),
    payerIdx: index("payments_payer_idx").on(t.payerId),
    payeeIdx: index("payments_payee_idx").on(t.payeeId),
    statusCreatedIdx: index("payments_status_created_idx").on(t.status, t.createdAt),
  }),
);

export type Payment = typeof paymentsTable.$inferSelect;
