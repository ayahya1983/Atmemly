import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const clientProfilesTable = pgTable(
  "client_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .unique()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull().default(""),
    logoUrl: text("logo_url"),
    overview: text("overview").notNull().default(""),
    location: text("location").notNull().default("Dubai, UAE"),
    verificationStatus: text("verification_status").notNull().default("not_submitted"),
    // Phase 3 — quality score (0..100). Recomputed on contract complete / dispute resolve / review.
    qualityScore: integer("quality_score").notNull().default(0),
    lastScoreAt: timestamp("last_score_at", { withTimezone: true }),
    // Architecture audit (May 2026) — track row updates.
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    qualityIdx: index("client_profiles_quality_idx").on(t.qualityScore),
  }),
);

export type ClientProfile = typeof clientProfilesTable.$inferSelect;
