import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const disputesTable = pgTable(
  "disputes",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id").notNull(),
    milestoneId: integer("milestone_id"),
    raisedById: integer("raised_by_id").notNull(),
    raisedAgainstId: integer("raised_against_id").notNull(),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"),
    resolutionNotes: text("resolution_notes"),
    resolvedById: integer("resolved_by_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contractIdx: index("disputes_contract_idx").on(t.contractId),
    statusIdx: index("disputes_status_idx").on(t.status),
    raisedByIdx: index("disputes_raised_by_idx").on(t.raisedById),
  }),
);

export type Dispute = typeof disputesTable.$inferSelect;

export const disputeMessagesTable = pgTable(
  "dispute_messages",
  {
    id: serial("id").primaryKey(),
    disputeId: integer("dispute_id").notNull(),
    senderId: integer("sender_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    disputeIdx: index("dispute_messages_dispute_idx").on(t.disputeId),
  }),
);

export type DisputeMessage = typeof disputeMessagesTable.$inferSelect;
