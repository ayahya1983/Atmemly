import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { identityProvidersTable } from "./identityProviders";

/**
 * Per-organization SSO enforcement. The `organizations` table itself is
 * not part of this task; this schema is laid down so future B2B/tenant
 * work can opt in. `organizationId` intentionally has no FK yet.
 */
export const organizationSsoSettingsTable = pgTable(
  "organization_sso_settings",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => identityProvidersTable.id, { onDelete: "cascade" }),
    forceSso: boolean("force_sso").notNull().default(false),
    // List of email domains owned by this org (for IDP-discovery).
    domains: jsonb("domains").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdx: index("organization_sso_settings_org_idx").on(t.organizationId),
    providerIdx: index("organization_sso_settings_provider_idx").on(
      t.providerId,
    ),
  }),
);

export type OrganizationSsoSetting =
  typeof organizationSsoSettingsTable.$inferSelect;

// Marker re-export for forward use.
export const SAML_READY = "saml_ready" as const;
