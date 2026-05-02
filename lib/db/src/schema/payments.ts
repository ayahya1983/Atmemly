import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  payerId: integer("payer_id").notNull(),
  payeeId: integer("payee_id").notNull(),
  contractId: integer("contract_id"),
  milestoneId: integer("milestone_id"),
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
});

export type Payment = typeof paymentsTable.$inferSelect;
