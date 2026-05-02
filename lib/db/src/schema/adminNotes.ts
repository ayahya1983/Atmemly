import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const adminNotesTable = pgTable(
  "admin_notes",
  {
    id: serial("id").primaryKey(),
    subjectKind: text("subject_kind").notNull(),
    subjectId: integer("subject_id").notNull(),
    authorId: integer("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subjectIdx: index("admin_notes_subject_idx").on(t.subjectKind, t.subjectId),
    authorIdx: index("admin_notes_author_idx").on(t.authorId),
  }),
);

export type AdminNote = typeof adminNotesTable.$inferSelect;
