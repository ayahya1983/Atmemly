import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  currency: text("currency").notNull().default("AED"),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  pendingBalance: numeric("pending_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  lifetimeEarnings: numeric("lifetime_earnings", { precision: 14, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Wallet = typeof walletsTable.$inferSelect;
