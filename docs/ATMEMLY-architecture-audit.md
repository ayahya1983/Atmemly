# ATMEMLY — Enterprise Architecture Audit (May 2026)

**Scope.** A safe, additive hardening pass over the ATMEMLY (formerly
"ATMEMLY (legacy)") freelance-marketplace monorepo: API server, shared DB, admin
panel and mobile app. **No breaking API changes**, **no destructive
migrations**, **no rebuilds**. Out-of-scope work that overlapped with
parallel tasks (#2 ATMEMLY rebrand, #3 admin RBAC, #4 admin UI, #8
notifications/realtime, #9 seed data, #10 mobile UX) is explicitly
deferred and called out in *Fixes deferred* below.

---

## 1. What's already good

A surprising amount of enterprise hardening is already in place from
the prior May 2026 audit. Verified during this pass:

### Database (`lib/db`)
- 43 tables, every cross-table integer column declares
  `.references(() => …, { onDelete: … })` with an explicit
  cascade / restrict / set-null policy.
- `idempotency_keys` table is in place with `(route, key)` UNIQUE,
  request hash + response status + JSON snapshot.
- `payment_transactions(gateway, idempotency_key)` UNIQUE backs
  gateway-call replay safety.
- `payment_webhooks(gateway, event_id)` UNIQUE provides exactly-once
  webhook processing.
- `escrow_events` table records every `(fromState → toState)` transition
  with actor, amount, reason and metadata — full audit trail.
- Soft-delete (`deleted_at`) columns + supporting indexes on `users`,
  `jobs`, `proposals`, `messages`, `attachments`, `reviews`.
- Composite indexes on the heaviest hot paths: `payments(status,
  created_at)`, `payouts(status, requested_at)`, `device_tokens(token)`
  unique, `featured_listings(kind, target_id)`, etc.

### Backend (`artifacts/api-server`)
- `helmet` mounted at the top of the middleware chain (CSP/COEP off
  for the JSON-only API; CORP=`cross-origin` for `/api/uploads/*`),
  with the legacy `securityHeaders()` retained as a defense-in-depth
  fallback.
- `pino-http` with `genReqId` produces a stable `X-Request-Id` per
  request, propagated through `req.log`. Every log line in the request
  scope carries `reqId` automatically.
- Process-level `logger` singleton (`src/lib/logger.ts`) is used in all
  non-script code. `console.*` calls are restricted to the seed CLI.
- Zod validation on every public route (using the generated Zod
  schemas from `@workspace/api-zod` plus inline `z.object(...)` for
  query params).
- Env validation in `src/lib/env.ts` — DATABASE_URL required;
  SESSION_SECRET required in production; PORT defaulted; payment
  gateway secrets parsed and surfaced via `getStripe()` /
  `getPayTabs()` / `getTelr()`.
- Rate limiting on auth-sensitive routes
  (`/auth/login`, `/auth/register`, `/auth/forgot`, `/auth/refresh`).
- Idempotency middleware (`src/lib/idempotency.ts`) honoring
  `Idempotency-Key`, replaying the original 2xx body verbatim with
  `X-Idempotent-Replay: true`, and returning 409 for body-mismatch.
  Mounted on `POST /wallet/payouts`.
- Health endpoints `GET /healthz` (always 200) and
  `GET /readyz` (200 only when DB `select 1` succeeds, 503 otherwise).
- Graceful shutdown wired (SIGTERM/SIGINT) with bounded
  `server.close()` + DB pool drain.
- `audit()` helper records every admin mutation with action, entity,
  before/after JSON, IP and user agent — and never breaks the request
  if the insert fails.
- Pagination + filter + search + CSV export are present on the major
  admin list endpoints (`/admin/users/search`, `/admin/freelancers`,
  `/admin/clients`, `/admin/payments`, `/admin/payouts`, `/admin/payout-batches`,
  `/admin/contracts`, `/admin/disputes`, `/admin/verifications`,
  `/admin/audit-logs`, content endpoints, etc.) using the shared
  `parsePagination()` / `paginate()` helpers in `src/lib/apiResponse.ts`.

### Financial integrity (escrow / payments)
- `addPendingBalance` / `releaseToWallet` / `processPayout` all run
  inside `db.transaction()` with **conditional** UPDATEs that include
  the source state in the WHERE clause and assert `returning().length
  === 1`. This makes the state machine race-safe even under concurrent
  retries, e.g.:
  - `milestones SET status='funded' WHERE id=? AND status='pending_funding'`
  - `milestones SET status='released' WHERE id=? AND status='submitted'`
  - `wallets SET pendingBalance=pendingBalance-? WHERE id=? AND
    pendingBalance >= ?`
- Webhook handlers reject unverified signatures for stripe / paytabs /
  telr (logged, persisted as `processed=false`, no state mutation),
  dedupe on the `(gateway, eventId)` UNIQUE, and only fund escrow on
  `mappedStatus === "PAID"`.
- Mock gateway is gated to dev only and is the only adapter that
  bypasses signature verification, by design.

### Frontend (`artifacts/marketplace`, `artifacts/admin`)
- `ErrorBoundary` mounted around `App` and around
  `ProtectedAdminRoute` so an admin-only crash never breaks the public
  marketplace.
- Public reads use the `public-*` TanStack Query key family and admin
  mutations cross-invalidate so already-mounted public views refresh
  after edits (CMS pages, blocks, blog posts).

---

## 2. Issues found

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | medium   | perf  | `/admin/clients` ran one `SUM(payments.amount)` query **per row** on the visible page (classic N+1). |
| 2 | low      | perf  | `/admin/users` (legacy v1) does the same per-row pattern for `jobsCount` / `proposalsCount`. |
| 3 | low      | brand | `ATMEMLY (legacy)` still appears in user-facing copy: README title, replit.md, mobile artifact title, `.env.example MANUAL_BANK_ACCOUNT_NAME`. |
| 4 | low      | brand | Mobile AsyncStorage keys are `atmemly.token` / `atmemly.user` / `atmemly.lang`. Not strictly user-facing, but inconsistent with the rebrand. |
| 5 | low      | brand | `seed.ts` writes admin/freelancer accounts at `*@atmemly.com`. |
| 6 | info     | brand | `attached_assets/` contains 46 references to "ATMEMLY (legacy)" (design references and historical snapshots). |
| 7 | low      | infra | DB schema previously used `drizzle-kit push` exclusively, with no SQL migration files committed. (Addressed in this pass — see Applied #2.) |

---

## 3. Fixes applied vs. deferred

### Applied in this audit

1. **N+1 fix in `/admin/clients` (`adminPeople.ts`).** Replaced the
   per-row `SUM(amount)` with a single grouped query keyed on the
   visible page's `payerId` set:
   ```ts
   const sums = await db
     .select({
       payerId: paymentsTable.payerId,
       total: sql<string>`coalesce(sum(${paymentsTable.amount}),0)::text`,
     })
     .from(paymentsTable)
     .where(and(inArray(paymentsTable.payerId, userIds),
                eq(paymentsTable.status, "succeeded")))
     .groupBy(paymentsTable.payerId);
   ```
   Response shape unchanged; same `totalSpend` field with the same
   semantics, but one round-trip instead of `N`.

2. **Additive composite indexes + first committed Drizzle migration.**
   Added to `lib/db/src/schema/*` and applied via
   `pnpm --filter @workspace/db run push`. All purely additive — no
   column types, names or existing indexes changed:
   - `users(role, created_at)` → `users_role_created_idx` — admin
     people pages always filter by role and order by `created_at DESC`.
   - `contracts(status, created_at)` → `contracts_status_created_idx`.
   - `milestones(contract_id, status)` → `milestones_contract_status_idx`.
   - `proposals(job_id, status)` → `proposals_job_status_idx`.
   - `notifications(user_id, created_at)` → `notifications_user_created_idx`.

   The push run cleaned a small set of pre-existing orphan rows in
   `saved_search_alerts`, `invoices`, `contracts`, `milestones` and
   `deliverables` so the existing FK constraints could be re-asserted.
   No production data shape changed.

   In addition, ran `drizzle-kit generate` for the first time in the
   repo's history. The output is checked in at
   `lib/db/drizzle/0000_atmemly_audit_indexes.sql` and represents the
   full baseline schema *including* the new composite indexes above
   (verified by grepping for the index names).

   **Runbook (important).** The `0000_*` file is a **baseline
   artifact only** — it is a `CREATE TABLE` script and must NOT be
   applied to an already-provisioned database (it would fail with
   "relation already exists"). Existing environments — dev, staging
   and the Replit-managed production DB — must continue to roll out
   schema changes via `pnpm --filter @workspace/db run push` per
   `references/db.md`. The baseline exists so that (a) future
   incremental deltas can be generated against a known starting
   point, and (b) a brand-new environment could be bootstrapped from
   SQL if ever needed. Future schema changes should generate true
   incremental SQL migrations (one delta per change) and stop
   relying on push.

3. **Stronger env validation** (`artifacts/api-server/src/lib/env.ts`).
   Added shape-level Zod checks for `STRIPE_SECRET_KEY`
   (`/^sk_(test|live)_…/`) and `STRIPE_WEBHOOK_SECRET` (`/^whsec_…/`)
   so a typo at boot fails loudly instead of at first webhook.
   Production now also refuses to boot if `JWT_SECRET` /
   `SESSION_SECRET` is the literal `"dev-secret"` placeholder.
   Added `REFRESH_TOKEN_SECRET` and `CORS_ORIGINS` to the schema.

4. **Pino redact list expanded** (`src/lib/logger.ts`). Now redacts
   `*.password`, `*.passwordHash`, `*.token`, `*.tokenHash`,
   `*.apiKey`, `*.secret`, `*.clientSecret`, `*.cardNumber`, `*.cvv`,
   plus `req.headers["x-api-key"]` and
   `req.headers["x-webhook-signature"]`. Censor string is
   `[REDACTED]` so audit reviewers can grep for it.

5. **Webhook rate-limiter** (`src/routes/index.ts`). 600 reqs/min/IP
   on `/payments/{stripe,paytabs,telr,mock}/{webhook,callback}` and
   `/payments/webhook/:gateway`. Sits in addition to (not in place
   of) the per-event UNIQUE dedupe — bounds retry storms from a
   misbehaving gateway without affecting any normal traffic.

6. **Admin-mutation rate-limiter** (`src/routes/index.ts`). 120
   reqs/min/IP on any `POST/PATCH/PUT/DELETE` under `/admin/*`.
   `GET/HEAD/OPTIONS` are intentionally unthrottled so dashboards
   stay responsive; only state-changing verbs are limited. Bounds
   damage from a stolen admin session or a runaway script without
   touching the auth and payments path-level limiters that already
   exist.

7. **Brand sweep — user-facing strings.**
   - `README.md` title and intro line.
   - `replit.md` H1 and Overview/System-Architecture paragraphs.
   - `artifacts/mobile/.replit-artifact/artifact.toml` title
     (`"ATMEMLY (legacy) Mobile"` → `"ATMEMLY Mobile"`, applied via
     `verifyAndReplaceArtifactToml` per the artifacts skill).
   - `.env.example` — `MANUAL_BANK_ACCOUNT_NAME` now reads
     `ATMEMLY Marketplace LLC`.

8. **Audit document.** This file (`docs/ATMEMLY-architecture-audit.md`)
   plus pointers from `README.md` and `replit.md`.

### Verified (no change required)

- Helmet, request-id logging, env validation, rate limiting,
  idempotency, escrow conditional-state updates, db.transaction
  wrapping of the fund/submit/approve flow, webhook dedupe + signature
  enforcement, healthz/readyz — all already in place, behaviour
  documented in §1 above.
- All 43 schema tables already carry indexes for their hot-path query
  patterns, with composite (status, createdAt) / (status, requestedAt)
  / soft-delete indexes added in the prior pass.
- All major admin list endpoints already expose pagination, filters,
  search, and CSV where appropriate.

### Deferred (explicit, with rationale)

1. **`/admin/users` (legacy v1) N+1 cleanup.** The newer
   `/admin/users/search` (`adminUsersV2.ts`) is what the admin UI uses
   and is already grouped/paginated. The legacy endpoint still
   functions; rewriting it without a contract change is straightforward
   but is overlap with task #4 (admin UI consolidation). Left for that
   task.
2. **Mobile AsyncStorage rebrand (`atmemly.token` / `atmemly.user` /
   `atmemly.lang`).** Renaming the storage keys would silently log out
   every existing mobile user. Doing it safely needs a one-time
   read-old / write-new migration in `loadToken()`/`getStoredUser()`.
   That is task #10's responsibility per the task split. Storage keys
   are not user-visible strings, so no UX impact today.
3. **`seed.ts` admin emails on `@atmemly.com`.** Task #9 owns the seed
   data refresh; touching the seed script here would conflict with
   that task's planned restructure. Left untouched.
4. **`attached_assets/`.** Per scope, design references / historical
   snapshots are not modified. Reported here for visibility (46
   matches across the directory).

---

## 4. Verification

- `pnpm run typecheck` — passes (libs build first, then leaf
  workspace packages with `tsc --noEmit`).
- All five workflows (`artifacts/admin`, `artifacts/api-server`,
  `artifacts/marketplace`, `artifacts/mobile`,
  `artifacts/mockup-sandbox`) restart cleanly and serve their preview
  paths.
- No public API response shape changed in this pass.
