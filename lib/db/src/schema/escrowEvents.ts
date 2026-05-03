import { pgTable, serial, integer, text, numeric, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";
import { milestonesTable } from "./milestones";
import { paymentsTable } from "./payments";
import { usersTable } from "./users";

export const escrowEventsTable = pgTable(
  "escrow_events",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").references(() => contractsTable.id, { onDelete: "set null" }),
    milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    paymentId: integer("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("AED"),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milestoneIdx: index("escrow_events_milestone_idx").on(t.milestoneId),
    contractIdx: index("escrow_events_contract_idx").on(t.contractId),
    createdIdx: index("escrow_events_created_idx").on(t.createdAt),
  }),
);

export type EscrowEvent = typeof escrowEventsTable.$inferSelect;
