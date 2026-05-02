import { pgTable, serial, integer, text, numeric, jsonb } from "drizzle-orm/pg-core";

export const freelancerProfilesTable = pgTable("freelancer_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AED"),
  location: text("location").notNull().default("Dubai, UAE"),
  skills: text("skills").array().notNull().default([]),
  portfolio: jsonb("portfolio").$type<Array<{ title: string; url: string; description?: string | null }>>().notNull().default([]),
  verificationStatus: text("verification_status").notNull().default("not_submitted"),
});

export type FreelancerProfile = typeof freelancerProfilesTable.$inferSelect;
