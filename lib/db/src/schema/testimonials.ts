import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const testimonialsTable = pgTable(
  "testimonials",
  {
    id: serial("id").primaryKey(),
    locale: text("locale").notNull(),
    authorName: text("author_name").notNull(),
    authorTitle: text("author_title"),
    body: text("body").notNull(),
    rating: integer("rating").notNull().default(5),
    avatarUrl: text("avatar_url"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    localeIdx: index("testimonials_locale_idx").on(t.locale, t.isFeatured, t.sortOrder),
  }),
);

export type Testimonial = typeof testimonialsTable.$inferSelect;
