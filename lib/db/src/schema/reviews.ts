import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026)
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    fromUserIdx: index("reviews_from_user_idx").on(t.fromUserId),
    toUserIdx: index("reviews_to_user_idx").on(t.toUserId),
    jobIdx: index("reviews_job_idx").on(t.jobId),
    deletedIdx: index("reviews_deleted_idx").on(t.deletedAt),
  }),
);

export type Review = typeof reviewsTable.$inferSelect;
