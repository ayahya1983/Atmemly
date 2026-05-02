import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const legalDocumentsTable = pgTable(
  "legal_documents",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    bodyEn: text("body_en").notNull(),
    bodyAr: text("body_ar").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    publishedById: integer("published_by_id"),
  },
  (t) => ({
    slugVersionUniq: uniqueIndex("legal_documents_slug_version_uniq").on(t.slug, t.version),
    slugCurrentIdx: index("legal_documents_slug_current_idx").on(t.slug, t.isCurrent),
  }),
);

export type LegalDocument = typeof legalDocumentsTable.$inferSelect;
