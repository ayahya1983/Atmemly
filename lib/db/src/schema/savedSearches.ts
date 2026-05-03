import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { jobsTable } from "./jobs";

export type SavedSearchQuery = {
  q?: string | null;
  category?: string | null;
  skill?: string | null;
  budgetType?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
};

export const savedSearchesTable = pgTable(
  "saved_searches",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query").$type<SavedSearchQuery>().notNull().default({}),
    notify: boolean("notify").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastNotifiedJobId: integer("last_notified_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("saved_searches_user_idx").on(t.userId),
  }),
);

export const savedSearchAlertsTable = pgTable(
  "saved_search_alerts",
  {
    id: serial("id").primaryKey(),
    savedSearchId: integer("saved_search_id")
      .notNull()
      .references(() => savedSearchesTable.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairIdx: uniqueIndex("saved_search_alerts_pair_uidx").on(t.savedSearchId, t.jobId),
  }),
);

export type SavedSearch = typeof savedSearchesTable.$inferSelect;
export type SavedSearchAlert = typeof savedSearchAlertsTable.$inferSelect;
