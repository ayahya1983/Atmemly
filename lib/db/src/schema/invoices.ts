import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    contractId: integer("contract_id"),
    milestoneId: integer("milestone_id"),
    paymentId: integer("payment_id"),
    clientId: integer("client_id").notNull(),
    freelancerId: integer("freelancer_id").notNull(),
    description: text("description").notNull().default(""),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("5"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("invoices_client_idx").on(t.clientId),
    freelancerIdx: index("invoices_freelancer_idx").on(t.freelancerId),
    paymentIdx: index("invoices_payment_idx").on(t.paymentId),
  }),
);

export type Invoice = typeof invoicesTable.$inferSelect;
