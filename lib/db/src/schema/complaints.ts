import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Complaint = typeof complaintsTable.$inferSelect;
