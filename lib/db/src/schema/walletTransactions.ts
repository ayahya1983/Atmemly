import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { walletsTable } from "./wallets";

export const walletTransactionsTable = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    walletId: integer("wallet_id")
      .notNull()
      .references(() => walletsTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    refType: text("ref_type"),
    refId: integer("ref_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("wallet_transactions_wallet_idx").on(t.walletId),
    createdIdx: index("wallet_transactions_created_idx").on(t.createdAt),
    typeIdx: index("wallet_transactions_type_idx").on(t.type),
  }),
);

export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
