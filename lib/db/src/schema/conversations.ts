import { pgTable, serial, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs";
import { usersTable } from "./users";

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    freelancerId: integer("freelancer_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("conversations_uniq").on(t.jobId, t.clientId, t.freelancerId),
    clientIdx: index("conversations_client_idx").on(t.clientId),
    freelancerIdx: index("conversations_freelancer_idx").on(t.freelancerId),
  }),
);

export type Conversation = typeof conversationsTable.$inferSelect;
