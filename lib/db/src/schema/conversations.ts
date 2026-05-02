import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull(),
    clientId: integer("client_id").notNull(),
    freelancerId: integer("freelancer_id").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("conversations_uniq").on(t.jobId, t.clientId, t.freelancerId),
  }),
);

export type Conversation = typeof conversationsTable.$inferSelect;
