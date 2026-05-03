import { pgTable, serial, integer, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const payoutsTable = pgTable(
  "payouts",
  {
    id: serial("id").primaryKey(),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("AED"),
    status: text("status").notNull().default("requested"),
    method: text("method").notNull().default("manual"),
    note: text("note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processedBy: integer("processed_by").references(() => usersTable.id, { onDelete: "set null" }),
    reference: text("reference"),
  },
  (t) => ({
    freelancerIdx: index("payouts_freelancer_idx").on(t.freelancerId),
    statusIdx: index("payouts_status_idx").on(t.status),
    statusRequestedIdx: index("payouts_status_requested_idx").on(t.status, t.requestedAt),
  }),
);

export type Payout = typeof payoutsTable.$inferSelect;
