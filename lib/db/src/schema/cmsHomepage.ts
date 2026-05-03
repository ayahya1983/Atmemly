import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface HomepageHero {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  searchPlaceholderAr: string;
  searchPlaceholderEn: string;
  imageUrl: string;
  ctaPrimaryLabelAr: string;
  ctaPrimaryLabelEn: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabelAr: string;
  ctaSecondaryLabelEn: string;
  ctaSecondaryHref: string;
}

export interface HomepageSection {
  key: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  isVisible: boolean;
  sortOrder: number;
}

export interface HomepageData {
  hero: HomepageHero;
  sections: HomepageSection[];
}

export const cmsHomepageTable = pgTable("cms_homepage", {
  id: serial("id").primaryKey(),
  data: jsonb("data").$type<HomepageData>().notNull(),
  updatedById: integer("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CmsHomepage = typeof cmsHomepageTable.$inferSelect;
