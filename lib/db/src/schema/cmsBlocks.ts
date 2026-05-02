import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const cmsBlocksTable = pgTable(
  "cms_blocks",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    title: text("title"),
    body: text("body").notNull().default(""),
    updatedById: integer("updated_by_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyLocaleUq: uniqueIndex("cms_blocks_key_locale_uq").on(t.key, t.locale),
  }),
);

export type CmsBlock = typeof cmsBlocksTable.$inferSelect;
