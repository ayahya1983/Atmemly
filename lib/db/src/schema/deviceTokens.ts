import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const deviceTokensTable = pgTable(
  "device_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    platform: text("platform").notNull(),
    token: text("token").notNull(),
    appVersion: text("app_version"),
    locale: text("locale"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("device_tokens_user_idx").on(t.userId),
    tokenUidx: uniqueIndex("device_tokens_token_uidx").on(t.token),
  }),
);

export type DeviceToken = typeof deviceTokensTable.$inferSelect;
