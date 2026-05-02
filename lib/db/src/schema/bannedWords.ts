import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const bannedWordsTable = pgTable(
  "banned_words",
  {
    id: serial("id").primaryKey(),
    word: text("word").notNull(),
    locale: text("locale").notNull().default("any"),
    severity: text("severity").notNull().default("med"),
    isActive: boolean("is_active").notNull().default(true),
    createdById: integer("created_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    wordLocaleUq: uniqueIndex("banned_words_word_locale_uq").on(t.word, t.locale),
  }),
);

export type BannedWord = typeof bannedWordsTable.$inferSelect;
