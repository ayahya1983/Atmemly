import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const attachmentsTable = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    uploaderId: integer("uploader_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    kind: text("kind").notNull().default("general"),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    url: text("url").notNull(),
    // media library metadata.
    altAr: text("alt_ar"),
    altEn: text("alt_en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Architecture audit (May 2026) — soft delete preserves audit/proof trail.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    uploaderIdx: index("attachments_uploader_idx").on(t.uploaderId),
    sha256Idx: index("attachments_sha256_idx").on(t.sha256),
    deletedIdx: index("attachments_deleted_idx").on(t.deletedAt),
  }),
);

export type Attachment = typeof attachmentsTable.$inferSelect;
