import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  payerId: integer("payer_id").notNull(),
  payeeId: integer("payee_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AED"),
  status: text("status").notNull().default("pending"),
  invoiceNumber: text("invoice_number").notNull(),
  stripeIntentId: text("stripe_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Payment = typeof paymentsTable.$inferSelect;
