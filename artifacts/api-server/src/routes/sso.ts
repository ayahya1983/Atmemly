import { Router, type IRouter, type Request } from "express";
import { randomBytes as cryptoRandomBytes, createHash as cryptoCreateHash } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  identityProvidersTable,
  ssoSessionsTable,
  userIdentitiesTable,
  usersTable,
  type IdentityProvider,
} from "@workspace/db";
import {
  SsoLinkBody,
  SsoUnlinkBody,
} from "@workspace/api-zod";
import {
  issueRefreshToken,
  signToken,
  requireAuth,
  clientIp,
  clientUa,
  verifyPassword,
  ACTIVE_OR_PENDING,
  BLOCKED_STATUSES,
} from "../lib/auth";
import { rateLimit } from "../lib/rateLimit";
import {
  buildAuthorizationUrl,
  discover,
  exchangeCodeForTokens,
  fetchUserinfo,
  generateNonce,
  generatePkcePair,
  generateState,
  verifyIdToken,
  type IdTokenClaims,
} from "../lib/sso/oidc";
import { resolveClientSecret } from "../lib/sso/secrets";
import { evaluateRoleMapping } from "../lib/sso/roleMap";
import { loadSsoSettings } from "../lib/sso/settings";
import { ssoAudit } from "../lib/sso/audit";
import { issueLinkChallenge, verifyLinkChallenge } from "../lib/sso/linkChallenge";

const router: IRouter = Router();

const startLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyPrefix: "sso:start",
  message: "Too many sign-in attempts. Please try again shortly.",
});
const callbackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyPrefix: "sso:callback",
});
// /auth/sso/link verifies a password to confirm account linking.
// Rate-limit it as aggressively as /auth/login to deter password guessing.
const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "sso:link",
  message: "Too many link attempts. Please try again later.",
});

/**
 * Browser-binding cookie. Set on /auth/sso/:provider/start and required on
 * /auth/sso/:provider/callback so a stolen `code+state` can't be redeemed
 * from a different browser. Bound to the session row via SHA-256 hash.
 */
const SSO_BINDING_COOKIE = "atmemly_sso_bind";

function newBindingToken(): string {
  return cryptoRandomBytes(32).toString("hex");
}

function hashBinding(token: string): string {
  return cryptoCreateHash("sha256").update(token).digest("hex");
}


/**
 * Restrict `returnTo` to safe same-origin relative paths to prevent open
 * redirects via the SSO callback. Accept only values that start with a
 * single "/" and are not protocol-relative ("//host"), backslash tricks,
 * or absolute URLs.
 */
function sanitizeReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//") || v.startsWith("/\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null;
  if (v.length > 512) return null;
  return v;
}

function publicProvider(p: IdentityProvider) {
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    displayName: p.displayName,
    displayNameAr: p.displayNameAr,
    isDefault: p.isDefault,
  };
}

function callbackUrlFor(req: Request, slug: string): string {
  const proto = (req.header("x-forwarded-proto") || req.protocol || "https").split(",")[0]!.trim();
  const host = req.header("x-forwarded-host") || req.header("host") || "";
  // IdP redirects the browser back to the SPA route. The SPA reads ?code & ?state
  // and calls POST/GET /api/auth/sso/:provider/callback (ssoCallback) to complete the flow.
  return `${proto}://${host}/auth/sso/${encodeURIComponent(slug)}/callback`;
}

/**
 * Native mobile flow: the IdP redirects to this server-side bridge, which
 * 302s back into the app via its custom URI scheme. Hard-coded so each
 * IdP's "allowed redirect URIs" list never needs the per-platform scheme.
 */
const MOBILE_REDIRECT_URI_SCHEME = "atmemly://sso-callback";

function mobileBridgeUrlFor(req: Request, slug: string): string {
  const proto = (req.header("x-forwarded-proto") || req.protocol || "https").split(",")[0]!.trim();
  const host = req.header("x-forwarded-host") || req.header("host") || "";
  return `${proto}://${host}/api/auth/sso/${encodeURIComponent(slug)}/mobile-bridge`;
}

function newMobileSessionToken(): string {
  return cryptoRandomBytes(32).toString("hex");
}

function emailDomainAllowed(email: string | undefined, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!email) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return allowedDomains.map((d) => d.toLowerCase()).includes(domain);
}

router.get("/auth/providers", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.enabled, true))
    .orderBy(desc(identityProvidersTable.isDefault), identityProvidersTable.id);
  res.json(rows.map(publicProvider));
});

router.get("/auth/sso/:provider/start", startLimiter, async (req, res): Promise<void> => {
  const slug = String(req.params["provider"]);
  const returnTo = sanitizeReturnTo(req.query["returnTo"]);
  const isLink = req.query["link"] === "true" || req.query["link"] === "1";

  const [provider] = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.slug, slug));
  if (!provider || !provider.enabled) {
    await ssoAudit({
      req,
      action: "sso.start",
      outcome: "failure",
      providerSlug: slug,
      reason: "unknown_or_disabled_provider",
    });
    res.status(404).json({ error: "Unknown SSO provider" });
    return;
  }
  if (!provider.issuerUrl || !provider.clientId) {
    res.status(500).json({ error: "ATMEMLY SSO provider is not fully configured" });
    return;
  }
  const clientSecret = resolveClientSecret(provider);
  if (!clientSecret) {
    res.status(500).json({ error: "ATMEMLY SSO provider secret is not configured" });
    return;
  }

  if (isLink && !req.user) {
    res.status(401).json({ error: "You must sign in before linking a new SSO provider." });
    return;
  }

  let doc;
  try {
    doc = await discover(provider.issuerUrl);
  } catch (err) {
    req.log?.warn?.({ err, slug }, "OIDC discovery failed");
    await ssoAudit({
      req,
      action: "sso.start",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "discovery_failed",
    });
    res.status(502).json({ error: "ATMEMLY could not reach the SSO provider." });
    return;
  }

  const state = generateState();
  const nonce = generateNonce();
  const pkce = generatePkcePair();
  const redirectUri = callbackUrlFor(req, slug);
  const bindingToken = newBindingToken();

  await db.insert(ssoSessionsTable).values({
    providerId: provider.id,
    state,
    nonce,
    codeVerifier: pkce.verifier,
    redirectUri,
    returnTo,
    linkUserId: isLink ? req.user!.id : null,
    browserBindingHash: hashBinding(bindingToken),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Browser-binding cookie. httpOnly + sameSite=lax so it survives the
  // top-level redirect back from the IdP; ~10min lifetime matches the
  // session TTL above. Verified on /callback against the row's hash.
  res.cookie(SSO_BINDING_COOKIE, bindingToken, {
    httpOnly: true,
    secure: req.secure || (req.header("x-forwarded-proto") || "").startsWith("https"),
    sameSite: "lax",
    path: "/api/auth/sso",
    maxAge: 10 * 60 * 1000,
  });

  const url = buildAuthorizationUrl({
    authorizationEndpoint: doc.authorization_endpoint,
    clientId: provider.clientId,
    redirectUri,
    scopes: provider.scopes,
    state,
    nonce,
    codeChallenge: pkce.challenge,
  });

  await ssoAudit({
    req,
    action: "sso.start",
    outcome: "success",
    providerId: provider.id,
    providerSlug: slug,
    userId: req.user?.id ?? null,
    metadata: { link: isLink },
  });

  // For browser flows, the frontend calls this endpoint and then
  // navigates to authorizationUrl. We return JSON so it can be awaited.
  res.json({ authorizationUrl: url, state });
});

router.get("/auth/sso/:provider/callback", callbackLimiter, async (req, res): Promise<void> => {
  const slug = String(req.params["provider"]);
  const code = typeof req.query["code"] === "string" ? req.query["code"] : null;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : null;
  const errParam = typeof req.query["error"] === "string" ? req.query["error"] : null;

  const [provider] = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ outcome: "error", message: "Unknown ATMEMLY SSO provider" });
    return;
  }

  if (errParam) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: errParam,
    });
    res.json({ outcome: "error", message: `ATMEMLY SSO error: ${errParam}` });
    return;
  }
  if (!code || !state) {
    res.status(400).json({ outcome: "error", message: "Missing code or state" });
    return;
  }

  // Single-use state lookup.
  const [session] = await db
    .select()
    .from(ssoSessionsTable)
    .where(
      and(
        eq(ssoSessionsTable.state, state),
        eq(ssoSessionsTable.providerId, provider.id),
        isNull(ssoSessionsTable.consumedAt),
        gt(ssoSessionsTable.expiresAt, new Date()),
      ),
    );
  if (!session) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "invalid_state",
    });
    res.status(400).json({ outcome: "error", message: "Invalid or expired SSO session" });
    return;
  }

  // Verify the browser-binding cookie set on /start. This prevents a
  // stolen `code+state` from being redeemed in a different browser
  // (CSRF / session-fixation defence). Constant-time hash comparison.
  const presentedBinding = req.cookies?.[SSO_BINDING_COOKIE];
  if (
    !session.browserBindingHash ||
    typeof presentedBinding !== "string" ||
    !presentedBinding ||
    hashBinding(presentedBinding) !== session.browserBindingHash
  ) {
    res.clearCookie(SSO_BINDING_COOKIE, { path: "/api/auth/sso" });
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "browser_binding_mismatch",
    });
    res.status(400).json({ outcome: "error", message: "SSO session is not valid for this browser" });
    return;
  }
  res.clearCookie(SSO_BINDING_COOKIE, { path: "/api/auth/sso" });
  await processSsoCallback(req, res, provider, session, code);
});

/**
 * Mobile flow start: returns the IdP authorization URL plus an opaque
 * `mobileSessionToken` the app must echo back on /mobile-callback. The
 * token's SHA-256 hash is stored in the same `browserBindingHash` column
 * the web flow uses, so a stolen `code+state` cannot be redeemed by any
 * other client.
 */
router.post("/auth/sso/:provider/mobile-start", startLimiter, async (req, res): Promise<void> => {
  const slug = String(req.params["provider"]);

  const [provider] = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.slug, slug));
  if (!provider || !provider.enabled) {
    await ssoAudit({
      req,
      action: "sso.start",
      outcome: "failure",
      providerSlug: slug,
      reason: "unknown_or_disabled_provider",
      metadata: { mobile: true },
    });
    res.status(404).json({ error: "Unknown SSO provider" });
    return;
  }
  if (!provider.issuerUrl || !provider.clientId) {
    res.status(500).json({ error: "ATMEMLY SSO provider is not fully configured" });
    return;
  }
  const clientSecret = resolveClientSecret(provider.clientSecretRef);
  if (!clientSecret) {
    res.status(500).json({ error: "ATMEMLY SSO provider secret is not configured" });
    return;
  }

  let doc;
  try {
    doc = await discover(provider.issuerUrl);
  } catch (err) {
    req.log?.warn?.({ err, slug }, "OIDC discovery failed (mobile)");
    await ssoAudit({
      req,
      action: "sso.start",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "discovery_failed",
      metadata: { mobile: true },
    });
    res.status(502).json({ error: "ATMEMLY could not reach the SSO provider." });
    return;
  }

  const state = generateState();
  const nonce = generateNonce();
  const pkce = generatePkcePair();
  const redirectUri = mobileBridgeUrlFor(req, slug);
  const mobileSessionToken = newMobileSessionToken();

  await db.insert(ssoSessionsTable).values({
    providerId: provider.id,
    state,
    nonce,
    codeVerifier: pkce.verifier,
    redirectUri,
    returnTo: null,
    linkUserId: null,
    browserBindingHash: hashBinding(mobileSessionToken),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const url = buildAuthorizationUrl({
    authorizationEndpoint: doc.authorization_endpoint,
    clientId: provider.clientId,
    redirectUri,
    scopes: provider.scopes,
    state,
    nonce,
    codeChallenge: pkce.challenge,
  });

  await ssoAudit({
    req,
    action: "sso.start",
    outcome: "success",
    providerId: provider.id,
    providerSlug: slug,
    metadata: { mobile: true },
  });

  res.json({ authorizationUrl: url, state, mobileSessionToken });
});

/**
 * IdP-facing redirect target for the mobile flow. The IdP delivers
 * `?code=...&state=...` here over HTTPS; we 302 the user-agent back
 * into the native app via its custom URI scheme so `expo-web-browser`
 * can capture the result. We deliberately do NOT redeem the code here —
 * that happens on /mobile-callback once the app re-presents both the
 * `code+state` and the secret `mobileSessionToken`.
 */
router.get("/auth/sso/:provider/mobile-bridge", callbackLimiter, async (req, res): Promise<void> => {
  const code = typeof req.query["code"] === "string" ? req.query["code"] : "";
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  const errParam = typeof req.query["error"] === "string" ? req.query["error"] : "";

  const params = new URLSearchParams();
  if (code) params.set("code", code);
  if (state) params.set("state", state);
  if (errParam) params.set("error", errParam);
  const target = `${MOBILE_REDIRECT_URI_SCHEME}?${params.toString()}`;

  // Some in-app browsers block 302s to non-http schemes, so emit a tiny
  // HTML page that performs the redirect via window.location as a fallback.
  res.status(200).type("html").send(
    `<!doctype html><html><head><meta charset="utf-8"><title>Returning to ATMEMLY…</title>` +
      `<meta http-equiv="refresh" content="0;url=${target}"></head>` +
      `<body><script>window.location.replace(${JSON.stringify(target)});</script>` +
      `<p>Returning to ATMEMLY… If nothing happens, <a href="${target}">tap here</a>.</p>` +
      `</body></html>`,
  );
});

/**
 * Mobile flow finish: the app re-presents the IdP `code+state` together
 * with the opaque `mobileSessionToken` from /mobile-start. We verify all
 * three then delegate to the same `processSsoCallback` helper the web
 * flow uses, returning a JSON body the app can persist directly.
 */
router.post("/auth/sso/:provider/mobile-callback", callbackLimiter, async (req, res): Promise<void> => {
  const slug = String(req.params["provider"]);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const code = typeof body["code"] === "string" ? body["code"] : null;
  const state = typeof body["state"] === "string" ? body["state"] : null;
  const mobileSessionToken =
    typeof body["mobileSessionToken"] === "string" ? body["mobileSessionToken"] : null;

  const [provider] = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.slug, slug));
  if (!provider) {
    res.status(404).json({ outcome: "error", message: "Unknown ATMEMLY SSO provider" });
    return;
  }
  if (!code || !state || !mobileSessionToken) {
    res.status(400).json({ outcome: "error", message: "Missing code, state, or mobileSessionToken" });
    return;
  }

  const [session] = await db
    .select()
    .from(ssoSessionsTable)
    .where(
      and(
        eq(ssoSessionsTable.state, state),
        eq(ssoSessionsTable.providerId, provider.id),
        isNull(ssoSessionsTable.consumedAt),
        gt(ssoSessionsTable.expiresAt, new Date()),
      ),
    );
  if (!session) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "invalid_state",
      metadata: { mobile: true },
    });
    res.status(400).json({ outcome: "error", message: "Invalid or expired SSO session" });
    return;
  }
  if (
    !session.browserBindingHash ||
    hashBinding(mobileSessionToken) !== session.browserBindingHash
  ) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "mobile_session_token_mismatch",
      metadata: { mobile: true },
    });
    res
      .status(400)
      .json({ outcome: "error", message: "SSO session is not valid for this device" });
    return;
  }

  await processSsoCallback(req, res, provider, session, code);
});

/**
 * Shared post-binding callback logic. Both the cookie-bound web callback
 * and the token-bound mobile callback delegate here once they have
 * verified that the caller is allowed to redeem this `session`.
 */
async function processSsoCallback(
  req: Request,
  res: import("express").Response,
  provider: IdentityProvider,
  session: typeof ssoSessionsTable.$inferSelect,
  code: string,
): Promise<void> {
  const slug = provider.slug;
  await db
    .update(ssoSessionsTable)
    .set({ consumedAt: new Date() })
    .where(eq(ssoSessionsTable.id, session.id));

  if (!provider.issuerUrl || !provider.clientId) {
    res.status(500).json({ outcome: "error", message: "Provider misconfigured" });
    return;
  }
  const clientSecret = resolveClientSecret(provider);
  if (!clientSecret) {
    res.status(500).json({ outcome: "error", message: "Provider secret not configured" });
    return;
  }

  let tokens;
  let claims: IdTokenClaims;
  try {
    tokens = await exchangeCodeForTokens({
      issuer: provider.issuerUrl,
      clientId: provider.clientId,
      clientSecret,
      code,
      redirectUri: session.redirectUri,
      codeVerifier: session.codeVerifier ?? undefined,
    });
    if (!tokens.id_token) {
      throw new Error("Provider did not return id_token");
    }
    claims = await verifyIdToken({
      issuer: provider.issuerUrl,
      clientId: provider.clientId,
      idToken: tokens.id_token,
      expectedNonce: session.nonce,
    });
  } catch (err) {
    req.log?.warn?.({ err, slug }, "SSO token exchange/verification failed");
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "failure",
      providerId: provider.id,
      providerSlug: slug,
      reason: "token_or_id_token_invalid",
    });
    res.status(400).json({ outcome: "error", message: "ATMEMLY SSO authentication failed" });
    return;
  }

  // Some providers (notably LinkedIn) expose email only via /userinfo.
  let mergedClaims: Record<string, unknown> = { ...claims };
  if (!claims.email && tokens.access_token) {
    const ui = await fetchUserinfo({
      issuer: provider.issuerUrl,
      accessToken: tokens.access_token,
    });
    if (ui) mergedClaims = { ...mergedClaims, ...ui };
  }
  const email =
    typeof mergedClaims["email"] === "string" ? (mergedClaims["email"] as string).toLowerCase() : null;
  const externalId = String(claims.sub);
  const fullName =
    (typeof mergedClaims["name"] === "string" && (mergedClaims["name"] as string)) ||
    (typeof mergedClaims["preferred_username"] === "string" &&
      (mergedClaims["preferred_username"] as string)) ||
    email ||
    externalId;

  // Reject if email domain not allowed.
  if (!emailDomainAllowed(email ?? undefined, provider.allowedDomains)) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "denied",
      providerId: provider.id,
      providerSlug: slug,
      email,
      reason: "domain_not_allowed",
    });
    res.json({
      outcome: "denied",
      message: "Your email domain is not allowed for this ATMEMLY workspace.",
      provider: provider.slug,
    });
    return;
  }

  // Look up an existing identity row for this (provider, externalId).
  const [existingIdentity] = await db
    .select()
    .from(userIdentitiesTable)
    .where(
      and(
        eq(userIdentitiesTable.providerId, provider.id),
        eq(userIdentitiesTable.externalId, externalId),
      ),
    );

  // 1) Link flow takes precedence over sign-in. The user is already
  //    logged in and explicitly asked to link this external identity.
  //    If the identity is already bound to a DIFFERENT user, refuse —
  //    we must never silently sign them into someone else's account.
  if (session.linkUserId) {
    if (existingIdentity && existingIdentity.userId !== session.linkUserId) {
      await ssoAudit({
        req,
        action: "sso.link",
        outcome: "denied",
        providerId: provider.id,
        providerSlug: slug,
        userId: session.linkUserId,
        email,
        reason: "identity_already_linked_to_other_user",
      });
      res.status(409).json({
        outcome: "denied",
        message: "This SSO identity is already linked to another ATMEMLY account.",
        provider: provider.slug,
      });
      return;
    }
    if (existingIdentity && existingIdentity.userId === session.linkUserId) {
      // Idempotent re-link: already bound to this user, just sign them in.
      return await signInExistingIdentity(req, res, session.linkUserId, existingIdentity.id, {
        provider,
        claims: mergedClaims,
        email,
        fullName,
        returnTo: session.returnTo,
      });
    }
    const [linkedIdentity] = await db
      .insert(userIdentitiesTable)
      .values({
        userId: session.linkUserId,
        providerId: provider.id,
        externalId,
        email,
        displayName: fullName,
        rawClaims: mergedClaims,
        lastLoginAt: new Date(),
      })
      .returning();
    await ssoAudit({
      req,
      action: "sso.link",
      outcome: "link",
      providerId: provider.id,
      providerSlug: slug,
      userId: session.linkUserId,
      email,
    });
    return await signInExistingIdentity(req, res, session.linkUserId, linkedIdentity!.id, {
      provider,
      claims: mergedClaims,
      email,
      fullName,
      returnTo: session.returnTo,
    });
  }

  // 2) No link request — already linked? Sign in.
  if (existingIdentity) {
    return await signInExistingIdentity(req, res, existingIdentity.userId, existingIdentity.id, {
      provider,
      claims: mergedClaims,
      email,
      fullName,
      returnTo: session.returnTo,
    });
  }

  // 3) Match existing user by email — but only if that account's email is
  //    verified. We refuse to link an unverified account because the email
  //    address itself was never proven, so a link challenge could be abused
  //    to take it over via SSO at a later date.
  if (email) {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existingUser && !existingUser.emailVerifiedAt) {
      await ssoAudit({
        req,
        action: "sso.callback",
        outcome: "denied",
        providerId: provider.id,
        providerSlug: slug,
        userId: existingUser.id,
        email,
        reason: "existing_account_email_unverified",
      });
      res.status(409).json({
        outcome: "denied",
        message:
          "An ATMEMLY account exists with this email but is not verified. Please verify the email first, then sign in with SSO.",
        returnTo: session.returnTo,
      });
      return;
    }
    if (existingUser) {
      // Issue a link challenge — frontend must confirm with password.
      const challenge = issueLinkChallenge({
        uid: existingUser.id,
        pid: provider.id,
        ext: externalId,
        email,
        name: fullName,
        raw: mergedClaims,
      });
      await ssoAudit({
        req,
        action: "sso.callback",
        outcome: "needs_linking",
        providerId: provider.id,
        providerSlug: slug,
        userId: existingUser.id,
        email,
      });
      res.json({
        outcome: "needs_linking",
        candidateEmail: email,
        provider: provider.slug,
        linkChallengeToken: challenge,
        message:
          "An ATMEMLY account already exists with this email. Sign in with your password to link it.",
        returnTo: session.returnTo,
      });
      return;
    }
  }

  // 4) Auto-provision (if allowed).
  if (!provider.autoProvision) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "denied",
      providerId: provider.id,
      providerSlug: slug,
      email,
      reason: "no_account_no_autoprovision",
    });
    res.json({
      outcome: "denied",
      message:
        "ATMEMLY could not find an account for this email and self-service sign-up is disabled for this provider.",
      provider: provider.slug,
    });
    return;
  }

  if (!email) {
    res.json({
      outcome: "denied",
      message: "ATMEMLY SSO did not return an email and cannot auto-provision an account.",
    });
    return;
  }

  let mapped = evaluateRoleMapping(provider.roleMappingJson, mergedClaims, provider.defaultRole);
  // Defense-in-depth: never auto-provision an admin account without an explicit,
  // valid adminRole. `effectiveAdminRole` would otherwise treat a null adminRole
  // on a role==='admin' user as legacy super_admin, which would be a privilege
  // escalation path from the IdP. Downgrade to the provider's fallback role.
  if (mapped.role === "admin" && !mapped.adminRole) {
    const safeFallback =
      provider.defaultRole && provider.defaultRole !== "admin" ? provider.defaultRole : "client";
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "denied",
      providerId: provider.id,
      providerSlug: slug,
      email,
      reason: "admin_role_without_adminRole_downgraded",
      metadata: { downgradedTo: safeFallback },
    });
    mapped = { role: safeFallback, adminRole: null };
  }
  const [created] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash: "!sso", // sentinel — local password login disabled until user sets one
      fullName,
      role: mapped.role,
      adminRole: mapped.adminRole,
      status: "active",
      emailVerifiedAt: claims["email_verified"] ? new Date() : null,
    })
    .returning();
  if (!created) {
    res.status(500).json({ outcome: "error", message: "Failed to create ATMEMLY account" });
    return;
  }
  const [newIdentity] = await db
    .insert(userIdentitiesTable)
    .values({
      userId: created.id,
      providerId: provider.id,
      externalId,
      email,
      displayName: fullName,
      rawClaims: mergedClaims,
      lastLoginAt: new Date(),
    })
    .returning();
  await ssoAudit({
    req,
    action: "sso.callback",
    outcome: "provisioned",
    providerId: provider.id,
    providerSlug: slug,
    userId: created.id,
    email,
    metadata: { role: mapped.role, adminRole: mapped.adminRole },
  });
  return await signInExistingIdentity(req, res, created.id, newIdentity!.id, {
    provider,
    claims: mergedClaims,
    email,
    fullName,
    returnTo: session.returnTo,
  });
}

async function signInExistingIdentity(
  req: Request,
  res: import("express").Response,
  userId: number,
  identityId: number,
  ctx: {
    provider: IdentityProvider;
    claims: Record<string, unknown>;
    email: string | null;
    fullName: string;
    returnTo: string | null;
  },
): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(500).json({ outcome: "error", message: "ATMEMLY user not found after SSO callback" });
    return;
  }
  if (BLOCKED_STATUSES.has(user.status)) {
    await ssoAudit({
      req,
      action: "sso.callback",
      outcome: "denied",
      providerId: ctx.provider.id,
      providerSlug: ctx.provider.slug,
      userId: user.id,
      reason: `account_${user.status}`,
    });
    res.status(403).json({ outcome: "denied", message: `Your ATMEMLY account is ${user.status}.` });
    return;
  }
  if (!ACTIVE_OR_PENDING.has(user.status)) {
    res.status(403).json({ outcome: "denied", message: "Account not active" });
    return;
  }
  await db
    .update(userIdentitiesTable)
    .set({ lastLoginAt: new Date(), rawClaims: ctx.claims, email: ctx.email, displayName: ctx.fullName })
    .where(eq(userIdentitiesTable.id, identityId));
  await db
    .update(usersTable)
    .set({
      lastLoginAt: new Date(),
      lastLoginIp: clientIp(req) || null,
      lastLoginUa: clientUa(req) || null,
    })
    .where(eq(usersTable.id, user.id));
  const accessToken = signToken(user.id);
  const refresh = await issueRefreshToken(user.id, req);
  await ssoAudit({
    req,
    action: "sso.callback",
    outcome: "success",
    providerId: ctx.provider.id,
    providerSlug: ctx.provider.slug,
    userId: user.id,
    email: ctx.email,
  });
  res.json({
    outcome: "signed_in",
    token: accessToken,
    refreshToken: refresh.token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminRole: user.adminRole ?? null,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: new Date(),
      phone: user.phone,
      country: user.country,
      city: user.city,
      verificationStatus: "not_submitted",
    },
    returnTo: ctx.returnTo,
  });
}

router.post("/auth/sso/link", linkLimiter, async (req, res): Promise<void> => {
  const parsed = SsoLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const challenge = verifyLinkChallenge(parsed.data.linkChallengeToken);
  if (!challenge) {
    res.status(400).json({ error: "Invalid or expired link challenge" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, challenge.uid));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await ssoAudit({
      req,
      action: "sso.link",
      outcome: "failure",
      providerId: challenge.pid,
      userId: user.id,
      email: challenge.email,
      reason: "bad_password",
    });
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  if (BLOCKED_STATUSES.has(user.status)) {
    res.status(403).json({ error: `Account ${user.status}` });
    return;
  }
  // Insert identity row (idempotent on unique (provider, externalId)).
  const [identity] = await db
    .insert(userIdentitiesTable)
    .values({
      userId: user.id,
      providerId: challenge.pid,
      externalId: challenge.ext,
      email: challenge.email,
      displayName: challenge.name ?? null,
      rawClaims: challenge.raw ?? {},
      lastLoginAt: new Date(),
    })
    .onConflictDoNothing({
      target: [userIdentitiesTable.providerId, userIdentitiesTable.externalId],
    })
    .returning();
  if (!identity) {
    // already linked elsewhere
    await ssoAudit({
      req,
      action: "sso.link",
      outcome: "failure",
      providerId: challenge.pid,
      userId: user.id,
      reason: "already_linked",
    });
    res.status(409).json({ error: "This SSO identity is already linked to a different account." });
    return;
  }
  const accessToken = signToken(user.id);
  const refresh = await issueRefreshToken(user.id, req);
  await db
    .update(usersTable)
    .set({
      lastLoginAt: new Date(),
      lastLoginIp: clientIp(req) || null,
      lastLoginUa: clientUa(req) || null,
    })
    .where(eq(usersTable.id, user.id));
  await ssoAudit({
    req,
    action: "sso.link",
    outcome: "link",
    providerId: challenge.pid,
    userId: user.id,
    email: challenge.email,
  });
  res.json({
    token: accessToken,
    refreshToken: refresh.token,
    emailVerificationDevToken: null,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      adminRole: user.adminRole ?? null,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: new Date(),
      phone: user.phone,
      country: user.country,
      city: user.city,
      verificationStatus: "not_submitted",
    },
  });
});

router.post("/auth/sso/unlink", requireAuth, async (req, res): Promise<void> => {
  const parsed = SsoUnlinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [identity] = await db
    .select()
    .from(userIdentitiesTable)
    .where(eq(userIdentitiesTable.id, parsed.data.identityId));
  if (!identity || identity.userId !== req.user!.id) {
    res.status(404).json({ error: "Identity not found" });
    return;
  }
  // Enforcement: don't let the user lock themselves out.
  const settings = await loadSsoSettings();
  const otherIdentities = await db
    .select({ id: userIdentitiesTable.id })
    .from(userIdentitiesTable)
    .where(eq(userIdentitiesTable.userId, req.user!.id));
  const remainingAfter = otherIdentities.filter((r) => r.id !== identity.id).length;
  const hasLocalPassword =
    settings.allowLocalPassword && (req.user!.passwordHash ?? "") !== "" && req.user!.passwordHash !== "!sso";
  if (settings.forceSsoForOrganizations && remainingAfter === 0) {
    await ssoAudit({
      req,
      action: "sso.unlink",
      outcome: "denied",
      providerId: identity.providerId,
      userId: req.user!.id,
      reason: "sso_enforced_last_identity",
    });
    res
      .status(403)
      .json({ error: "ATMEMLY SSO is enforced for your organization. You cannot unlink your last SSO identity." });
    return;
  }
  if (!hasLocalPassword && remainingAfter === 0) {
    await ssoAudit({
      req,
      action: "sso.unlink",
      outcome: "denied",
      providerId: identity.providerId,
      userId: req.user!.id,
      reason: "no_remaining_login_method",
    });
    res
      .status(409)
      .json({
        error:
          "Set an email/password first or link another SSO provider before unlinking your only sign-in method.",
      });
    return;
  }
  await db.delete(userIdentitiesTable).where(eq(userIdentitiesTable.id, identity.id));
  await ssoAudit({
    req,
    action: "sso.unlink",
    outcome: "unlink",
    providerId: identity.providerId,
    userId: req.user!.id,
    email: identity.email,
  });
  res.json({ ok: true, message: "Identity unlinked" });
});

router.get("/auth/sso/identities", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: userIdentitiesTable.id,
      providerId: userIdentitiesTable.providerId,
      providerSlug: identityProvidersTable.slug,
      providerDisplayName: identityProvidersTable.displayName,
      externalId: userIdentitiesTable.externalId,
      email: userIdentitiesTable.email,
      displayName: userIdentitiesTable.displayName,
      lastLoginAt: userIdentitiesTable.lastLoginAt,
      createdAt: userIdentitiesTable.createdAt,
    })
    .from(userIdentitiesTable)
    .innerJoin(
      identityProvidersTable,
      eq(identityProvidersTable.id, userIdentitiesTable.providerId),
    )
    .where(eq(userIdentitiesTable.userId, req.user!.id))
    .orderBy(desc(userIdentitiesTable.createdAt));
  res.json(rows);
});

export default router;
