import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Registry of available payment gateways. Adapters are code-resident
 * (lib/payments/*) — this row carries admin-controlled config: active
 * toggle, mode (TEST/LIVE), supported currencies, and a free-form
 * configJson for non-secret display config (secrets always come from env).
 */
export const paymentGatewaysTable = pgTable(
  "payment_gateways",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    providerCode: text("provider_code").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    mode: text("mode").notNull().default("TEST"),
    supportedCurrencies: jsonb("supported_currencies").$type<string[]>().notNull().default([]),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerUidx: uniqueIndex("payment_gateways_provider_uidx").on(t.providerCode),
    activeIdx: index("payment_gateways_active_idx").on(t.isActive),
  }),
);

export type PaymentGatewayRow = typeof paymentGatewaysTable.$inferSelect;
