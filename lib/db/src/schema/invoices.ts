import { pgTable, serial, integer, text, numeric, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";
import { milestonesTable } from "./milestones";
import { paymentsTable } from "./payments";
import { usersTable } from "./users";

/**
 * Invoices are immutable financial records: subtotal/vat/total and the
 * client/freelancer linkage are SNAPSHOTTED at issue time. Never mutate
 * an existing row — re-issue a new invoice with a credit note instead.
 * Architecture audit (May 2026): contractId/milestoneId/paymentId remain
 * nullable so the invoice survives soft-delete of those parents.
 */
export const invoicesTable = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
    milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    paymentId: integer("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    description: text("description").notNull().default(""),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("5"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    trn: text("trn"),
    placeOfSupply: text("place_of_supply").notNull().default("AE"),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    invoiceTypeCode: text("invoice_type_code").notNull().default("standard"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("invoices_client_idx").on(t.clientId),
    freelancerIdx: index("invoices_freelancer_idx").on(t.freelancerId),
    paymentIdx: index("invoices_payment_idx").on(t.paymentId),
    issuedIdx: index("invoices_issued_idx").on(t.issuedAt),
  }),
);

export type Invoice = typeof invoicesTable.$inferSelect;
