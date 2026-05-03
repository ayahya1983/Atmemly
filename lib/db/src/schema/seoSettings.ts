import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const seoSettingsTable = pgTable("seo_settings", {
  id: serial("id").primaryKey(),
  siteTitleAr: text("site_title_ar").notNull().default(""),
  siteTitleEn: text("site_title_en").notNull().default(""),
  siteDescriptionAr: text("site_description_ar").notNull().default(""),
  siteDescriptionEn: text("site_description_en").notNull().default(""),
  ogImageUrl: text("og_image_url"),
  twitterHandle: text("twitter_handle"),
  defaultLocale: text("default_locale").notNull().default("ar"),
  updatedById: integer("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SeoSettings = typeof seoSettingsTable.$inferSelect;
