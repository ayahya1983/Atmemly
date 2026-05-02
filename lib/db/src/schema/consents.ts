import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const consentsTable = pgTable(
  "consents",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    documentId: integer("document_id").notNull(),
    documentSlug: text("document_slug").notNull(),
    documentVersion: integer("document_version").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("consents_user_idx").on(t.userId),
    docIdx: index("consents_doc_idx").on(t.documentId),
  }),
);

export type Consent = typeof consentsTable.$inferSelect;
