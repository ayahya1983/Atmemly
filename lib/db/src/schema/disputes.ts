import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { contractsTable } from "./contracts";
import { milestonesTable } from "./milestones";
import { usersTable } from "./users";

export const disputesTable = pgTable(
  "disputes",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id")
      .notNull()
      .references(() => contractsTable.id, { onDelete: "restrict" }),
    milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
    raisedById: integer("raised_by_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    raisedAgainstId: integer("raised_against_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("open"),
    resolutionNotes: text("resolution_notes"),
    resolvedById: integer("resolved_by_id").references(() => usersTable.id, { onDelete: "set null" }),
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
    disputeId: integer("dispute_id")
      .notNull()
      .references(() => disputesTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    disputeIdx: index("dispute_messages_dispute_idx").on(t.disputeId),
  }),
);

export type DisputeMessage = typeof disputeMessagesTable.$inferSelect;
