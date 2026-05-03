import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026) — updatedAt for read-toggle ordering.
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.read),
    // ATMEMLY audit (May 2026) — notification feed always orders newest-first
    // per user; this composite serves the bell-icon and inbox queries.
    userCreatedIdx: index("notifications_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
