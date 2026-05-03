import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const verificationsTable = pgTable(
  "verifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    documentUrls: text("document_urls").array().notNull().default([]),
    fullLegalName: text("full_legal_name"),
    documentNumber: text("document_number"),
    notes: text("notes"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  },
  (t) => ({
    userIdx: index("verifications_user_idx").on(t.userId),
    statusIdx: index("verifications_status_idx").on(t.status),
  }),
);

export type Verification = typeof verificationsTable.$inferSelect;
