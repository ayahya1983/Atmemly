import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Gateway-side intent / checkout session reference. One row per
 * createIntent call. Multiple intents can map to one transaction if
 * the user retries (intent_id changes per gateway call but the
 * payment_transactions row stays via idempotency).
 */
export const paymentIntentsTable = pgTable(
  "payment_intents",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id").notNull(),
    gateway: text("gateway").notNull(),
    intentRef: text("intent_ref").notNull(),
    clientSecret: text("client_secret"),
    redirectUrl: text("redirect_url"),
    status: text("status").notNull().default("requires_payment"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    txIdx: index("payment_intents_tx_idx").on(t.transactionId),
    refUidx: uniqueIndex("payment_intents_ref_uidx").on(t.gateway, t.intentRef),
  }),
);

export type PaymentIntentRow = typeof paymentIntentsTable.$inferSelect;
