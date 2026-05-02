import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const freelancerProfilesTable = pgTable(
  "freelancer_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().unique(),
    headline: text("headline").notNull().default(""),
    bio: text("bio").notNull().default(""),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("AED"),
    location: text("location").notNull().default("Dubai, UAE"),
    skills: text("skills").array().notNull().default([]),
    portfolio: jsonb("portfolio")
      .$type<Array<{ title: string; url: string; description?: string | null }>>()
      .notNull()
      .default([]),
    verificationStatus: text("verification_status").notNull().default("not_submitted"),
    // Phase 3 — denormalized trust score (0..100). Recomputed on review/contract/verification events.
    trustScore: integer("trust_score").notNull().default(0),
    lastScoreAt: timestamp("last_score_at", { withTimezone: true }),
  },
  (t) => ({
    trustIdx: index("freelancer_profiles_trust_idx").on(t.trustScore),
  }),
);

export type FreelancerProfile = typeof freelancerProfilesTable.$inferSelect;
