import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  freelancerId: integer("freelancer_id").notNull(),
  coverLetter: text("cover_letter").notNull(),
  expectedRate: numeric("expected_rate", { precision: 12, scale: 2 }).notNull(),
  deliveryDays: integer("delivery_days").notNull(),
  portfolioLinks: text("portfolio_links").array().notNull().default([]),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Proposal = typeof proposalsTable.$inferSelect;
