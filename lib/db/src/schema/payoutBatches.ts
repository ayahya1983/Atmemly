import { pgTable, serial, integer, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { payoutsTable } from "./payouts";

export const payoutBatchesTable = pgTable(
  "payout_batches",
  {
    id: serial("id").primaryKey(),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("AED"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    itemCount: integer("item_count").notNull().default(0),
    note: text("note"),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    processedById: integer("processed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("payout_batches_status_idx").on(t.status),
  }),
);

export const payoutBatchItemsTable = pgTable(
  "payout_batch_items",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => payoutBatchesTable.id, { onDelete: "cascade" }),
    payoutId: integer("payout_id")
      .notNull()
      .references(() => payoutsTable.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    payoutUidx: uniqueIndex("payout_batch_items_payout_uidx").on(t.payoutId),
    batchIdx: index("payout_batch_items_batch_idx").on(t.batchId),
  }),
);

export type PayoutBatch = typeof payoutBatchesTable.$inferSelect;
export type PayoutBatchItem = typeof payoutBatchItemsTable.$inferSelect;
