import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { logger } from "../logger";

/**
 * OIDC discovery + token validation utilities.
 *
 * Provider-agnostic: we discover the authorization/token/jwks endpoints
 * from `${issuer}/.well-known/openid-configuration` and validate ID tokens
 * against the published JWKS. This is enough to support Google, Microsoft
 * Entra, Keycloak, and any compliant generic OIDC provider.
 *
 * LinkedIn historically diverged from spec but now exposes a discovery
 * document at https://www.linkedin.com/oauth/.well-known/openid-configuration
 * — we treat it the same way.
 */

export interface OidcDiscoveryDoc {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  response_types_supported?: string[];
  scopes_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

const discoveryCache = new Map<
  string,
  { doc: OidcDiscoveryDoc; jwks: ReturnType<typeof createRemoteJWKSet>; expires: number }
>();
const DISCOVERY_TTL_MS = 60 * 60 * 1000; // 1 hour

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/$/, "");
}

export async function discover(issuer: string): Promise<OidcDiscoveryDoc> {
  const norm = normalizeIssuer(issuer);
  const now = Date.now();
  const cached = discoveryCache.get(norm);
  if (cached && cached.expires > now) return cached.doc;

  const url = `${norm}/.well-known/openid-configuration`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} for ${url}`);
  }
  const doc = (await res.json()) as OidcDiscoveryDoc;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error(`OIDC discovery doc missing required fields for ${norm}`);
  }
  const jwks = createRemoteJWKSet(new URL(doc.jwks_uri), {
    cooldownDuration: 30_000,
    cacheMaxAge: 60 * 60 * 1000,
  });
  discoveryCache.set(norm, { doc, jwks, expires: now + DISCOVERY_TTL_MS });
  return doc;
}

export async function getJwks(issuer: string) {
  await discover(issuer);
  const norm = normalizeIssuer(issuer);
  const entry = discoveryCache.get(norm);
  if (!entry) throw new Error("JWKS unavailable after discovery");
  return entry.jwks;
}

export interface IdTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [k: string]: unknown;
}

export async function verifyIdToken(args: {
  issuer: string;
  clientId: string;
  idToken: string;
  expectedNonce?: string;
}): Promise<IdTokenClaims> {
  const doc = await discover(args.issuer);
  const jwks = await getJwks(args.issuer);
  const { payload } = await jwtVerify(args.idToken, jwks, {
    issuer: doc.issuer,
    audience: args.clientId,
    clockTolerance: 30,
  });
  if (args.expectedNonce && payload["nonce"] !== args.expectedNonce) {
    throw new Error("ID token nonce mismatch");
  }
  return payload as IdTokenClaims;
}

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizationUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  nonce: string;
  codeChallenge?: string;
  extraParams?: Record<string, string>;
}): string {
  const u = new URL(args.authorizationEndpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", args.scopes);
  u.searchParams.set("state", args.state);
  u.searchParams.set("nonce", args.nonce);
  if (args.codeChallenge) {
    u.searchParams.set("code_challenge", args.codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  if (args.extraParams) {
    for (const [k, v] of Object.entries(args.extraParams)) {
      u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export async function exchangeCodeForTokens(args: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<TokenResponse> {
  const doc = await discover(args.issuer);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", args.code);
  body.set("redirect_uri", args.redirectUri);
  body.set("client_id", args.clientId);
  body.set("client_secret", args.clientSecret);
  if (args.codeVerifier) body.set("code_verifier", args.codeVerifier);
  const res = await fetch(doc.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    logger.warn({ status: res.status, body: text }, "OIDC token exchange failed");
    throw new Error(`Token exchange failed: ${res.status}`);
  }
  try {
    return JSON.parse(text) as TokenResponse;
  } catch {
    throw new Error("Token endpoint returned non-JSON response");
  }
}

export async function fetchUserinfo(args: {
  issuer: string;
  accessToken: string;
}): Promise<Record<string, unknown> | null> {
  const doc = await discover(args.issuer);
  if (!doc.userinfo_endpoint) return null;
  const res = await fetch(doc.userinfo_endpoint, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}
