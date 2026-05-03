import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const testimonialsTable = pgTable(
  "testimonials",
  {
    id: serial("id").primaryKey(),
    locale: text("locale").notNull(),
    authorName: text("author_name").notNull(),
    authorTitle: text("author_title"),
    // extended public-content fields. Bilingual quote pair lets a
    // single testimonial render on both Arabic + English sites; the legacy
    // single-locale `body` field is kept for back-compat and falls back when
    // a bilingual pair is not provided.
    role: text("role"),
    company: text("company"),
    location: text("location"),
    quoteAr: text("quote_ar"),
    quoteEn: text("quote_en"),
    body: text("body").notNull(),
    rating: integer("rating").notNull().default(5),
    avatarUrl: text("avatar_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    localeIdx: index("testimonials_locale_idx").on(t.locale, t.isFeatured, t.sortOrder),
  }),
);

export type Testimonial = typeof testimonialsTable.$inferSelect;
