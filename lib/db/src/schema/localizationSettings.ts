import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// Singleton (id=1) row holding global localization-level settings:
// - defaultLocale: which locale public pages render when no preference is
//   detected (separate from SEO defaults so admins can split concerns).
// - rtlLocales: locales that should render right-to-left.
// - enabledLocales: locales the public site exposes.
export const localizationSettingsTable = pgTable("localization_settings", {
  id: serial("id").primaryKey(),
  defaultLocale: text("default_locale").notNull().default("ar"),
  enabledLocales: jsonb("enabled_locales").$type<string[]>().notNull().default(["ar", "en"]),
  rtlLocales: jsonb("rtl_locales").$type<string[]>().notNull().default(["ar"]),
  fallbackLocale: text("fallback_locale").notNull().default("en"),
  isRtlByDefault: boolean("is_rtl_by_default").notNull().default(true),
  updatedById: integer("updated_by_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LocalizationSettings = typeof localizationSettingsTable.$inferSelect;
