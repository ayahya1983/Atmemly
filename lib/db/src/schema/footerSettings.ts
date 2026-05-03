import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export interface SocialLink {
  platform: string;
  url: string;
}

export const footerSettingsTable = pgTable("footer_settings", {
  id: serial("id").primaryKey(),
  descriptionAr: text("description_ar").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  addressAr: text("address_ar").notNull().default(""),
  addressEn: text("address_en").notNull().default(""),
  copyrightAr: text("copyright_ar").notNull().default(""),
  copyrightEn: text("copyright_en").notNull().default(""),
  socialLinks: jsonb("social_links").$type<SocialLink[]>().notNull().default([]),
  updatedById: integer("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const footerLinkGroupsTable = pgTable(
  "footer_link_groups",
  {
    id: serial("id").primaryKey(),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sortIdx: index("footer_groups_sort_idx").on(t.sortOrder),
  }),
);

export const footerLinksTable = pgTable(
  "footer_links",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id").notNull(),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    href: text("href").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    groupIdx: index("footer_links_group_idx").on(t.groupId, t.sortOrder),
  }),
);

export type FooterSettings = typeof footerSettingsTable.$inferSelect;
export type FooterLinkGroup = typeof footerLinkGroupsTable.$inferSelect;
export type FooterLink = typeof footerLinksTable.$inferSelect;
