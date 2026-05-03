import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messagesTable = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026) — soft delete for moderation.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    conversationIdx: index("messages_conversation_idx").on(t.conversationId),
    senderIdx: index("messages_sender_idx").on(t.senderId),
    deletedIdx: index("messages_deleted_idx").on(t.deletedAt),
  }),
);

export type Message = typeof messagesTable.$inferSelect;
