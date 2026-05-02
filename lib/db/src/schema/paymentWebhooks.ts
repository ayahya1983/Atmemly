import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Raw webhook events from each gateway. UNIQUE on (gateway, event_id)
 * so duplicate deliveries are de-duplicated at insert time and the
 * handler can short-circuit safely.
 */
export const paymentWebhooksTable = pgTable(
  "payment_webhooks",
  {
    id: serial("id").primaryKey(),
    gateway: text("gateway").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    transactionId: integer("transaction_id"),
    signatureValid: boolean("signature_valid").notNull().default(false),
    processed: boolean("processed").notNull().default(false),
    processError: text("process_error"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => ({
    eventUidx: uniqueIndex("payment_webhooks_event_uidx").on(t.gateway, t.eventId),
    gatewayIdx: index("payment_webhooks_gateway_idx").on(t.gateway),
    typeIdx: index("payment_webhooks_type_idx").on(t.eventType),
  }),
);

export type PaymentWebhookRow = typeof paymentWebhooksTable.$inferSelect;
