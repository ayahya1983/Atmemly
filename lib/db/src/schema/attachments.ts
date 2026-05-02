import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const attachmentsTable = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    uploaderId: integer("uploader_id").notNull(),
    kind: text("kind").notNull().default("general"),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uploaderIdx: index("attachments_uploader_idx").on(t.uploaderId),
    sha256Idx: index("attachments_sha256_idx").on(t.sha256),
  }),
);

export type Attachment = typeof attachmentsTable.$inferSelect;
