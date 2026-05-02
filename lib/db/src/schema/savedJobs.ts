import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const savedJobsTable = pgTable(
  "saved_jobs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    jobId: integer("job_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("saved_jobs_user_job_uniq").on(t.userId, t.jobId),
  }),
);

export type SavedJob = typeof savedJobsTable.$inferSelect;
