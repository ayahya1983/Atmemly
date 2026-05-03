/**
 * SSO end-to-end smoke test (Task #17).
 *
 * Exercises every code path that does NOT require an interactive Google
 * consent screen: provider listing, /start (PKCE+state+nonce+binding
 * cookie), /callback failure branches, OIDC discovery + JWKS reachability,
 * password-link challenge flow, and audit-log writes for each.
 *
 * Run with the API server running (workflow `artifacts/api-server: API
 * Server`):
 *
 *   pnpm --filter @workspace/scripts run sso-smoke
 *
 * Required env: DATABASE_URL, SESSION_SECRET, GOOGLE_OAUTH_CLIENT_ID,
 * GOOGLE_OAUTH_CLIENT_SECRET, REPLIT_DEV_DOMAIN.
 *
 * Exits non-zero on any assertion failure. On success prints PASS for
 * each step plus a summary of audit rows created during the run.
 */
import { Client } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API = process.env.SSO_SMOKE_API_BASE ?? "http://localhost:80/api";
const DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? "localhost";
const HEADERS: Record<string, string> = {
  Host: DOMAIN,
  "X-Forwarded-Host": DOMAIN,
  "X-Forwarded-Proto": "https",
};

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(name: string, cond: unknown, detail?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ""}`);
  }
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { ...init, headers: { ...HEADERS, ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sessionSecret =
    process.env.SESSION_SECRET ?? process.env.JWT_SECRET ?? "dev-insecure-secret-change-me";

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const auditBefore = (await pg.query("SELECT count(*)::int AS n FROM login_audit_logs")).rows[0]
    .n as number;

  // 0. Ensure google provider row exists & enabled.
  console.log("0. Ensure google identity_providers row");
  const cid = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!cid) throw new Error("GOOGLE_OAUTH_CLIENT_ID required");
  await pg.query(
    `INSERT INTO identity_providers
       (slug, type, display_name, display_name_ar, enabled, is_default, issuer_url, client_id, client_secret_ref, scopes, auto_provision, allowed_domains, default_role)
     VALUES ('google','google','Google','جوجل',true,true,'https://accounts.google.com',$1,'env:GOOGLE_OAUTH_CLIENT_SECRET','openid email profile',true,'[]'::jsonb,'client')
     ON CONFLICT (slug) DO UPDATE SET enabled=true, is_default=true, issuer_url=EXCLUDED.issuer_url,
       client_id=EXCLUDED.client_id, client_secret_ref=EXCLUDED.client_secret_ref,
       scopes=EXCLUDED.scopes, auto_provision=true, updated_at=now()`,
    [cid],
  );
  const { rows: provRows } = await pg.query(
    "SELECT id, slug, enabled, is_default FROM identity_providers WHERE slug='google'",
  );
  assert("google provider row enabled+default", provRows[0]?.enabled === true && provRows[0]?.is_default === true);
  const providerId = provRows[0].id as number;

  // 1. /auth/providers
  console.log("1. GET /auth/providers");
  const providers = await fetchJson(`${API}/auth/providers`);
  assert("providers status 200", providers.status === 200, providers);
  const list = Array.isArray(providers.body) ? providers.body : [];
  const google = list.find((p: any) => p.slug === "google");
  assert("providers includes google", !!google);
  assert("google marked default", google?.isDefault === true);

  // 2. /auth/sso/google/start
  console.log("2. GET /auth/sso/google/start");
  const startRes = await fetch(`${API}/auth/sso/google/start`, { headers: HEADERS });
  const startBody = (await startRes.json()) as { authorizationUrl?: string; state?: string };
  assert("start status 200", startRes.status === 200, startRes.status);
  assert("authorizationUrl present", typeof startBody.authorizationUrl === "string");
  const u = new URL(startBody.authorizationUrl ?? "https://x");
  assert("authz host is accounts.google.com", u.host === "accounts.google.com");
  assert("response_type=code", u.searchParams.get("response_type") === "code");
  assert("scope contains openid", (u.searchParams.get("scope") ?? "").includes("openid"));
  assert("state present", !!u.searchParams.get("state"));
  assert("nonce present", !!u.searchParams.get("nonce"));
  assert("PKCE S256", u.searchParams.get("code_challenge_method") === "S256");
  assert("redirect_uri uses public domain", (u.searchParams.get("redirect_uri") ?? "").startsWith(`https://${DOMAIN}/`));
  const setCookie = startRes.headers.get("set-cookie") ?? "";
  assert("binding cookie set + HttpOnly + SameSite=Lax", /atmemly_sso_bind=/.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie));

  // 3. Bad-state callback
  console.log("3. GET /auth/sso/google/callback with bad state");
  const badState = await fetchJson(`${API}/auth/sso/google/callback?code=fake&state=__nope__`);
  assert("bad-state returns 400", badState.status === 400, badState);
  assert("bad-state outcome=error", badState.body?.outcome === "error");

  // 4. IdP error param
  console.log("4. GET /auth/sso/google/callback with error=access_denied");
  const errCb = await fetchJson(`${API}/auth/sso/google/callback?error=access_denied&state=x`);
  assert("error-param returns 200 JSON", errCb.status === 200);
  assert("error-param body mentions access_denied", String(errCb.body?.message ?? "").includes("access_denied"));

  // 5. Unknown provider
  console.log("5. GET /auth/sso/__unknown__/start");
  const unk = await fetchJson(`${API}/auth/sso/__nope__/start`);
  assert("unknown provider returns 404", unk.status === 404);

  // 6. Google OIDC discovery + JWKS reachable
  console.log("6. Google discovery + JWKS reachability");
  const disc = await fetch("https://accounts.google.com/.well-known/openid-configuration");
  assert("discovery 200", disc.status === 200);
  const discJson = (await disc.json()) as { jwks_uri?: string; issuer?: string };
  assert("issuer is https://accounts.google.com", discJson.issuer === "https://accounts.google.com");
  const jwks = await fetch(discJson.jwks_uri ?? "");
  const jwksJson = (await jwks.json()) as { keys: Array<{ alg: string }> };
  assert("JWKS has keys", Array.isArray(jwksJson.keys) && jwksJson.keys.length > 0);

  // 7. Password-link flow
  console.log("7. password-link flow (existing-email collision)");
  const email = `sso-link-test+${Date.now()}@example.test`;
  const password = "TestPassw0rd!";
  const hash = await bcrypt.hash(password, 10);
  const { rows: userRows } = await pg.query(
    `INSERT INTO users (email, password_hash, full_name, role, status, email_verified_at)
     VALUES ($1, $2, 'SSO Link Test User', 'client', 'active', now()) RETURNING id`,
    [email, hash],
  );
  const userId = userRows[0].id as number;
  const externalId = `google-sub-smoke-${userId}-${Date.now()}`;
  const challenge = jwt.sign(
    { uid: userId, pid: providerId, ext: externalId, email, name: "SSO Link Test User", raw: { sub: externalId, email_verified: true } },
    sessionSecret,
    { expiresIn: 600, audience: "sso-link" },
  );
  const wrongPw = await fetchJson(`${API}/auth/sso/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkChallengeToken: challenge, password: "wrong" }),
  });
  assert("link wrong-password 401", wrongPw.status === 401);
  const okLink = await fetchJson(`${API}/auth/sso/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkChallengeToken: challenge, password }),
  });
  assert("link correct-password 200", okLink.status === 200, okLink.body);
  assert("link returns ATMEMLY JWT", typeof okLink.body?.token === "string" && okLink.body.token.split(".").length === 3);
  assert("link returns refresh token", typeof okLink.body?.refreshToken === "string");
  assert("link returns user.id matches", okLink.body?.user?.id === userId);
  const { rows: idRows } = await pg.query(
    "SELECT id FROM user_identities WHERE user_id=$1 AND provider_id=$2 AND external_id=$3",
    [userId, providerId, externalId],
  );
  assert("user_identities row created", idRows.length === 1);

  // 8. Audit rows produced
  console.log("8. audit rows");
  const { rows: auditAfterRows } = await pg.query(
    `SELECT action, outcome, reason FROM login_audit_logs WHERE id > $1 ORDER BY id`,
    [auditBefore],
  );
  const haveStartSuccess = auditAfterRows.some((r) => r.action === "sso.start" && r.outcome === "success");
  const haveCbInvalidState = auditAfterRows.some((r) => r.action === "sso.callback" && r.reason === "invalid_state");
  const haveCbAccessDenied = auditAfterRows.some((r) => r.action === "sso.callback" && r.reason === "access_denied");
  const haveStartFailure = auditAfterRows.some((r) => r.action === "sso.start" && r.outcome === "failure");
  const haveLinkBadPw = auditAfterRows.some((r) => r.action === "sso.link" && r.reason === "bad_password");
  const haveLinkSuccess = auditAfterRows.some((r) => r.action === "sso.link" && r.outcome === "link");
  assert("audit: sso.start success", haveStartSuccess);
  assert("audit: sso.callback invalid_state", haveCbInvalidState);
  assert("audit: sso.callback access_denied", haveCbAccessDenied);
  assert("audit: sso.start failure (unknown provider)", haveStartFailure);
  assert("audit: sso.link bad_password", haveLinkBadPw);
  assert("audit: sso.link success (link)", haveLinkSuccess);

  await pg.end();

  console.log(`\nSummary: ${pass} passed, ${fail} failed.`);
  if (fail > 0) {
    console.log("Failures:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(2);
});
