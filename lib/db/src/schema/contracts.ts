import { pgTable, serial, integer, text, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";
import { proposalsTable } from "./proposals";

export const contractsTable = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "restrict" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposalsTable.id, { onDelete: "restrict" }),
    contractType: text("contract_type").notNull().default("fixed_price"),
    title: text("title").notNull(),
    scope: text("scope").notNull().default(""),
    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    endDate: timestamp("end_date", { withTimezone: true }),
    status: text("status").notNull().default("pending_client_payment"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("AED"),
    platformFeePct: numeric("platform_fee_pct", { precision: 5, scale: 2 }).notNull().default("10"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: integer("cancelled_by").references(() => usersTable.id, { onDelete: "set null" }),
    cancellationReason: text("cancellation_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("contracts_client_idx").on(t.clientId),
    freelancerIdx: index("contracts_freelancer_idx").on(t.freelancerId),
    jobIdx: index("contracts_job_idx").on(t.jobId),
    statusIdx: index("contracts_status_idx").on(t.status),
    proposalUnique: uniqueIndex("contracts_proposal_unique").on(t.proposalId),
  }),
);

export type Contract = typeof contractsTable.$inferSelect;
