import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const emailVerificationTokensTable = pgTable(
  "email_verification_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashIdx: index("email_verification_tokens_hash_idx").on(t.tokenHash),
    userIdx: index("email_verification_tokens_user_idx").on(t.userId),
  }),
);

export type EmailVerificationToken = typeof emailVerificationTokensTable.$inferSelect;
