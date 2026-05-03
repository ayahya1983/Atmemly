import { pgTable, serial, text, jsonb, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * Architecture audit (May 2026) — server-side replay protection for write
 * routes (payment intent creation, payout creation, webhook ingestion).
 *
 * Lookup is by (route, key). When the same key/route arrives a second time
 * we return the stored response_snapshot verbatim, preserving the original
 * status code. requestHash protects against a client reusing the same key
 * for a different payload (we surface a 409 in that case).
 */
export const idempotencyKeysTable = pgTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    route: text("route").notNull(),
    key: text("key").notNull(),
    userId: integer("user_id"),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseSnapshot: jsonb("response_snapshot").$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    routeKeyUidx: uniqueIndex("idempotency_keys_route_key_uidx").on(t.route, t.key),
    createdIdx: index("idempotency_keys_created_idx").on(t.createdAt),
  }),
);

export type IdempotencyKey = typeof idempotencyKeysTable.$inferSelect;
