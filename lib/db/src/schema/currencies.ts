import { pgTable, serial, text, integer, boolean, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const currenciesTable = pgTable(
  "currencies",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    symbol: text("symbol"),
    decimals: integer("decimals").notNull().default(2),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUidx: uniqueIndex("currencies_code_uidx").on(t.code),
  }),
);

export const fxRatesTable = pgTable(
  "fx_rates",
  {
    id: serial("id").primaryKey(),
    base: text("base").notNull(),
    quote: text("quote").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    source: text("source").notNull().default("manual"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairFetchedIdx: index("fx_rates_pair_fetched_idx").on(t.base, t.quote, t.fetchedAt),
  }),
);

export type Currency = typeof currenciesTable.$inferSelect;
export type FxRate = typeof fxRatesTable.$inferSelect;
