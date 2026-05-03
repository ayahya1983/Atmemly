import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const localizationStringsTable = pgTable(
  "localization_strings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    namespace: text("namespace").notNull().default("common"),
    value: text("value").notNull(),
    isMissing: boolean("is_missing").notNull().default(false),
    updatedById: integer("updated_by_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyLocaleUq: uniqueIndex("localization_strings_key_locale_uq").on(t.key, t.locale),
  }),
);

export type LocalizationString = typeof localizationStringsTable.$inferSelect;
