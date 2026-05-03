import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const navigationItemsTable = pgTable(
  "navigation_items",
  {
    id: serial("id").primaryKey(),
    location: text("location").notNull(), // HEADER | FOOTER
    parentId: integer("parent_id"),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    href: text("href").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    locationIdx: index("nav_items_location_idx").on(t.location, t.sortOrder),
  }),
);

export type NavigationItem = typeof navigationItemsTable.$inferSelect;
