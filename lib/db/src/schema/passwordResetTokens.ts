import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashIdx: index("password_reset_tokens_hash_idx").on(t.tokenHash),
  }),
);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
