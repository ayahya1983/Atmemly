import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  boolean,
  index,
  integer,
} from "drizzle-orm/pg-core";

/**
 * ATMEMLY enterprise SSO — identity provider configuration.
 *
 * One row per OIDC provider that the platform can authenticate against.
 * `type` controls provider-specific quirks (e.g. LinkedIn's non-standard
 * userinfo endpoint, Microsoft tenant URL templating). For the generic
 * `oidc` and `keycloak` types, `issuerUrl` plus OIDC discovery is enough.
 *
 * Secrets are NEVER stored in plaintext here — `clientSecretRef` is a
 * pointer (env-var name or KMS reference) resolved server-side at runtime.
 */
export const identityProvidersTable = pgTable(
  "identity_providers",
  {
    id: serial("id").primaryKey(),
    // human-readable slug used in URLs: /auth/sso/:provider/start
    slug: text("slug").notNull().unique(),
    // type: google | linkedin | microsoft | keycloak | oidc | saml_ready
    type: text("type").notNull(),
    displayName: text("display_name").notNull(),
    displayNameAr: text("display_name_ar"),
    enabled: boolean("enabled").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),

    // OIDC config
    issuerUrl: text("issuer_url"),
    clientId: text("client_id"),
    // Pointer (e.g. "env:GOOGLE_CLIENT_SECRET") — never the raw secret.
    clientSecretRef: text("client_secret_ref"),
    // App-level AEAD ciphertext when the admin pasted a raw secret in the
    // UI (AES-256-GCM, key derived from SSO_SECRET_ENC_KEY/SESSION_SECRET).
    // Format: "v1:<base64(iv|tag|ciphertext)>". Never returned in API
    // responses; resolved transparently by lib/sso/secrets.ts.
    clientSecretEnc: text("client_secret_enc"),
    scopes: text("scopes").notNull().default("openid email profile"),

    // Provisioning policy
    autoProvision: boolean("auto_provision").notNull().default(false),
    // List of email domains allowed; empty = any.
    allowedDomains: jsonb("allowed_domains")
      .$type<string[]>()
      .notNull()
      .default([]),
    // Default role assigned when auto-provisioning a brand-new user.
    defaultRole: text("default_role").notNull().default("client"),

    // Role-mapping rules. See lib/sso/roleMap.ts for shape.
    roleMappingJson: jsonb("role_mapping_json")
      .$type<unknown>()
      .notNull()
      .default({}),

    // Optional Microsoft tenant id, Keycloak realm, etc.
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
    createdById: integer("created_by_id"),
  },
  (t) => ({
    enabledIdx: index("identity_providers_enabled_idx").on(t.enabled),
    typeIdx: index("identity_providers_type_idx").on(t.type),
  }),
);

export type IdentityProvider = typeof identityProvidersTable.$inferSelect;
