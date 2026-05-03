import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const complaintsTable = pgTable(
  "complaints",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("complaints_status_idx").on(t.status),
    fromUserIdx: index("complaints_from_user_idx").on(t.fromUserId),
  }),
);

export type Complaint = typeof complaintsTable.$inferSelect;
