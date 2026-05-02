import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const featuredListingsTable = pgTable(
  "featured_listings",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    targetId: integer("target_id").notNull(),
    sponsorUserId: integer("sponsor_user_id"),
    paymentId: integer("payment_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kindTargetIdx: index("featured_listings_kind_target_idx").on(t.kind, t.targetId),
    endsAtIdx: index("featured_listings_ends_at_idx").on(t.endsAt),
  }),
);

export type FeaturedListing = typeof featuredListingsTable.$inferSelect;
