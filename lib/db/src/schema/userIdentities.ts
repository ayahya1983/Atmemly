import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { identityProvidersTable } from "./identityProviders";

/**
 * Link between an ATMEMLY user and an external SSO identity (Google sub,
 * Microsoft oid, etc). One row per (provider, externalId).
 */
export const userIdentitiesTable = pgTable(
  "user_identities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    providerId: integer("provider_id")
      .notNull()
      .references(() => identityProvidersTable.id, { onDelete: "cascade" }),
    // The provider's stable subject identifier (sub, oid, etc).
    externalId: text("external_id").notNull(),
    email: text("email"),
    displayName: text("display_name"),
    // Snapshot of the most recent ID-token claims (no refresh tokens stored).
    rawClaims: jsonb("raw_claims")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    providerExternalUq: uniqueIndex("user_identities_provider_external_uq").on(
      t.providerId,
      t.externalId,
    ),
    userIdx: index("user_identities_user_idx").on(t.userId),
    emailIdx: index("user_identities_email_idx").on(t.email),
  }),
);

export type UserIdentity = typeof userIdentitiesTable.$inferSelect;
