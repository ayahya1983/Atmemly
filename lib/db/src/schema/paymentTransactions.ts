import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One row per payment attempt at the gateway level. Sits ALONGSIDE the
 * Phase-1 `payments` table (which is contract/milestone-anchored). A PT
 * row can later link a `paymentId` once escrow is established.
 *
 * status enum (string): INITIATED | PENDING | REQUIRES_ACTION | PAID
 *  | FAILED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED
 *  | ESCROW_HELD | RELEASED | DISPUTED
 *
 * paymentPurpose enum (string): contract_funding | milestone_funding
 *  | subscription | featured_listing | other
 */
export const paymentTransactionsTable = pgTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    contractId: integer("contract_id"),
    milestoneId: integer("milestone_id"),
    invoiceId: integer("invoice_id"),
    paymentId: integer("payment_id"), // FK-ish to payments.id once escrow is created
    gateway: text("gateway").notNull(),
    gatewayReference: text("gateway_reference"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    status: text("status").notNull().default("INITIATED"),
    paymentPurpose: text("payment_purpose").notNull().default("milestone_funding"),
    idempotencyKey: text("idempotency_key"),
    failureReason: text("failure_reason"),
    proofAttachmentId: integer("proof_attachment_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("payment_transactions_user_idx").on(t.userId),
    contractIdx: index("payment_transactions_contract_idx").on(t.contractId),
    milestoneIdx: index("payment_transactions_milestone_idx").on(t.milestoneId),
    statusIdx: index("payment_transactions_status_idx").on(t.status),
    gatewayIdx: index("payment_transactions_gateway_idx").on(t.gateway),
    createdIdx: index("payment_transactions_created_idx").on(t.createdAt),
    idempotencyUidx: uniqueIndex("payment_transactions_idem_uidx").on(t.gateway, t.idempotencyKey),
    // UNIQUE on (gateway, gateway_reference). Postgres treats NULL as distinct
    // by default, so the brief window between INSERT (ref=NULL) and the post-
    // createIntent UPDATE (ref set) does NOT block multiple in-flight rows;
    // once a real reference is written, no two PT rows can share it within a
    // gateway. This makes webhook lookup by gatewayReference unambiguous.
    gatewayRefUidx: uniqueIndex("payment_transactions_gw_ref_uidx").on(t.gateway, t.gatewayReference),
  }),
);

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
