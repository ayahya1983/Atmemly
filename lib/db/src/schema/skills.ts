import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const skillsTable = pgTable("skills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export type SkillRow = typeof skillsTable.$inferSelect;
