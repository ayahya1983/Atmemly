import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const faqCategoriesTable = pgTable(
  "faq_categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    seoTitleAr: text("seo_title_ar"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionAr: text("seo_description_ar"),
    seoDescriptionEn: text("seo_description_en"),
    seoImageUrl: text("seo_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUq: uniqueIndex("faq_categories_slug_uq").on(t.slug),
  }),
);

export type FaqCategory = typeof faqCategoriesTable.$inferSelect;
