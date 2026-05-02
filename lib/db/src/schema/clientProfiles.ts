import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

export const clientProfilesTable = pgTable("client_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  companyName: text("company_name").notNull().default(""),
  logoUrl: text("logo_url"),
  overview: text("overview").notNull().default(""),
  location: text("location").notNull().default("Dubai, UAE"),
});

export type ClientProfile = typeof clientProfilesTable.$inferSelect;
