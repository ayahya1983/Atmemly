import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { identityProvidersTable } from "./identityProviders";

/**
 * Short-lived server-side state for an in-flight OIDC authorization
 * request. Single-use: marked consumed (`consumedAt`) on callback to
 * prevent replay. TTL ~10 minutes; expired rows are ignored.
 */
export const ssoSessionsTable = pgTable(
  "sso_sessions",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => identityProvidersTable.id, { onDelete: "cascade" }),
    state: text("state").notNull().unique(),
    nonce: text("nonce").notNull(),
    codeVerifier: text("code_verifier"),
    redirectUri: text("redirect_uri").notNull(),
    // Where to send the user after a successful sign-in (e.g. /admin/, /).
    returnTo: text("return_to"),
    // Optional: the currently-logged-in user's id when this is a "link"
    // flow rather than a fresh sign-in.
    linkUserId: integer("link_user_id"),
    // SHA-256 hex of the random binding token stored in the
    // `atmemly_sso_bind` httpOnly cookie. Required to match on callback
    // so a stolen `code+state` cannot be redeemed from another browser.
    browserBindingHash: text("browser_binding_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    expiresIdx: index("sso_sessions_expires_idx").on(t.expiresAt),
    providerIdx: index("sso_sessions_provider_idx").on(t.providerId),
  }),
);

export type SsoSession = typeof ssoSessionsTable.$inferSelect;
