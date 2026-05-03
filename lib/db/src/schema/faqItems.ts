import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const faqItemsTable = pgTable(
  "faq_items",
  {
    id: serial("id").primaryKey(),
    locale: text("locale").notNull(),
    category: text("category").notNull().default("general"),
    // FK to faq_categories.id (kept nullable for back-compat).
    categoryId: integer("category_id"),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    localeCatIdx: index("faq_items_locale_cat_idx").on(t.locale, t.category, t.sortOrder),
  }),
);

export type FaqItem = typeof faqItemsTable.$inferSelect;
