import { pgTable, serial, integer, text, numeric, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const escrowEventsTable = pgTable(
  "escrow_events",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id"),
    milestoneId: integer("milestone_id"),
    paymentId: integer("payment_id"),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("AED"),
    actorUserId: integer("actor_user_id"),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    milestoneIdx: index("escrow_events_milestone_idx").on(t.milestoneId),
    contractIdx: index("escrow_events_contract_idx").on(t.contractId),
  }),
);

export type EscrowEvent = typeof escrowEventsTable.$inferSelect;
