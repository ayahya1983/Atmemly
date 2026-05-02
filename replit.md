# Khidma — UAE/GCC Bilingual Freelance Marketplace

A bilingual (English/Arabic) freelance marketplace MVP for the UAE and wider GCC region, inspired by atmemli.com. Brand color #458CCA, Cairo font, Arabic-first RTL support.

## Architecture

- Monorepo (pnpm workspaces) with three running artifacts:
  - `artifacts/api-server` — Express + TypeScript API on `/api` (port 8080).
  - `artifacts/marketplace` — React + Vite frontend served at `/` (the user-facing site).
  - `artifacts/mockup-sandbox` — design preview sandbox (not used in production).
- Shared libs:
  - `lib/db` — Drizzle ORM schema + connection (PostgreSQL via `DATABASE_URL`).
  - `lib/api-spec` — OpenAPI source of truth.
  - `lib/api-zod` — Zod schemas generated from OpenAPI for server validation.
  - `lib/api-client-react` — Orval-generated React Query hooks for the frontend.

## Stack

- **Backend:** Express, TypeScript, JWT (HS256, secret = `SESSION_SECRET`), bcrypt for passwords, Drizzle ORM, Postgres, pino logger.
- **Frontend:** React 18, Vite, wouter (router), TanStack Query, shadcn/ui, Tailwind, zustand (i18n state, persisted to localStorage), react-hook-form + zod.
- **Payments:** Mock Stripe — `useCreatePaymentIntent` accepts a cosmetic card form and immediately marks the payment as paid. No live keys, no real charges.
- **Chat:** HTTP polling every 4 seconds (no websockets).
- **i18n:** EN/AR with RTL flip via `<html dir>`. Helper `formatCurrency(amount, "AED", lang)` renders `AED 1,200` in EN and `1,200 د.إ` in AR.

## Data Model (lib/db schema)

Core: users, client_profiles, freelancer_profiles, categories, skills, freelancer_skills, jobs, job_skills, proposals, conversations, messages, saved_jobs, payments, reviews, notifications, complaints.

Phase 1 hardening additions: refresh_tokens, password_reset_tokens, email_verification_tokens, audit_logs, verifications, contracts, milestones, deliverables, invoices, wallets, wallet_transactions, payouts. The existing `payments` table was extended with `contractId`, `milestoneId`, `platformFeePct/Amount`, `freelancerNetAmount`, `heldAt`, `releasedAt` (escrow state). `users` was extended with `emailVerifiedAt`, `lastLoginAt/Ip/Ua`, `phone`, `country`, `city`. `freelancer_profiles` and `client_profiles` gained `verificationStatus`.

## Auth

- JWT (HS256, secret = `SESSION_SECRET`) in `Authorization: Bearer <token>` header, injected by `src/lib/custom-fetch.ts` from `localStorage.auth_token`. Access token TTL = 1h.
- Refresh tokens are opaque random strings stored as SHA-256 hashes in `refresh_tokens` (TTL 30d). `/auth/refresh` rotates the refresh token and issues a new access token. `/auth/logout` revokes a presented refresh token.
- `AuthContext.login(token, user)` persists the token and seeds the user. `useGetMe` rehydrates on reload.
- Role guards in `App.tsx`: `ProtectedClientRoute`, `ProtectedFreelancerRoute`, `ProtectedAdminRoute` redirect to `/login` on mismatch.

### User status enum & middleware
- `active`, `pending_email_verification`, `suspended`, `banned`, `deleted`.
- New registrations land as `pending_email_verification`. Verification flips them to `active`.
- `requireAuth` (default) blocks `suspended/banned/deleted` only — `pending_email_verification` is allowed for backward compat with the existing frontend.
- `requireActiveAuth` (strict) requires `active` status.
- `requireRole("client" | "freelancer" | "admin", ...)` gates by role.

### Auth endpoints (Phase 1)
- `POST /auth/register`, `/auth/login` — both return `{ token, refreshToken, user }`. Register also returns `emailVerificationDevToken` in dev (`NODE_ENV !== "production"`) since we have no email service.
- `POST /auth/refresh` (body: `refreshToken`), `/auth/logout` (body: optional `refreshToken`).
- `POST /auth/forgot-password` (always returns 200; dev returns `devToken`), `/auth/reset-password`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/change-password`.
- `lib/auth.ts` exports `hashOpaqueToken`, `issueRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`.

## Verification (KYC) workflow
- `POST /verifications` — freelancer or client submits `kind` (`identity` | `trade_license`) + document URLs. Sets `freelancer_profiles.verificationStatus` / `client_profiles.verificationStatus` to `pending`.
- `GET /verifications` returns latest submission for the current user.
- `GET /admin/verifications?status=pending` and `PATCH /admin/verifications/:id` (body `{ decision: "approve"|"reject", reason? }`) — admin reviews. Approve flips profile.verificationStatus to `verified`; reject sets `rejected` with reason and notifies the user.

## Contracts, milestones, escrow, invoices
- Accepting a proposal (`PATCH /proposals/:id/status` → `accepted`) auto-creates a `contracts` row in `pending_client_payment` with `platformFeePct=10`, currency from job, total = `proposal.expectedRate`. All other pending proposals on the same job are auto-rejected.
- `GET /contracts`, `GET /contracts/:id`, `PATCH /contracts/:id` (`{ action: "cancel"|"complete", reason? }`). Cancel is blocked if any milestone is funded (admin override allowed). Complete requires all milestones released.
- `POST /contracts/:id/milestones` (client only, fixed-price contracts) creates a milestone in `pending_funding`.
- `POST /milestones/:id/fund` (client) — creates a mock `payments` row (`status: held`, `stripeIntentId: pi_mock_…`), generates an `invoices` row with VAT 5% (currency AED by default), credits the freelancer wallet `pendingBalance`, sets milestone status `funded`, transitions the contract to `active`.
- `POST /milestones/:id/submit` (freelancer) — appends a `deliverables` row with auto-incremented `revisionNumber`, sets milestone `submitted`, contract `submitted_for_review`, notifies client.
- `POST /milestones/:id/approve` (client) — moves wallet `pendingBalance` → `availableBalance` net of platform fee (10% default), records `release` and negative `fee` ledger entries, sets milestone `released`, payment `released`. When **all** milestones are released the contract auto-completes and the job is marked `completed`.
- `POST /milestones/:id/request-revision` (client) — milestone → `revision_requested`, contract → `revision_requested`, notifies freelancer.
- `GET /invoices`, `GET /invoices/:id` — bilateral access (client + freelancer + admin). Invoice numbers are `INV-YYYY-XXXXXXX-NNN`.

## Wallet & payouts
- `GET /wallet/me` — auto-creates a wallet (currency AED) and returns balances + last 50 ledger transactions.
- `POST /wallet/payouts` (freelancer, body `{ amount, note? }`) — debits `availableBalance`, inserts a `payouts` row in `requested`.
- `GET /admin/payouts`, `POST /admin/payouts/:id/process` (body optional `{ reference, note }`) — admin marks paid, audit-logged.

## Audit logs
- Helper `audit(req, action, entityType, entityId, metadata)` in `lib/audit.ts` writes to `audit_logs` with ip + user-agent. Wired into: register, login (success/blocked/fail), logout, refresh, password change/reset, verify-email/resend, verification submit/approve/reject, contract create/cancel/complete, milestone create/fund/submit/approve/request_revision, payout request/process.
- `GET /admin/audit-logs?limit=&action=` — admin only.

## Seeded Test Accounts

- Admin: `admin@khidma.ae` / `admin1234`
- Client: `noor@nooragency.ae` / `client1234`
- Freelancer: `layla@khidma.ae` / `freelancer1234`
- Plus 4 more freelancers and 1 more client; 10 jobs across multiple categories.

Re-seed with: `pnpm --filter @workspace/api-server run seed`.

## Common commands

- Typecheck the whole repo: `pnpm run typecheck`
- Typecheck just the marketplace: `pnpm --filter @workspace/marketplace run typecheck`
- Regenerate API hooks/zod after editing the OpenAPI spec: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema changes: `pnpm --filter @workspace/db run push`

## Conventions / pitfalls

- Generated React Query hooks **require** an explicit `queryKey` whenever a `query` options object is passed. Always spread `getXyzQueryKey(...)` into the options.
- Generated mutation hooks for body-less endpoints (e.g. `useSaveJob`, `useUnsaveJob`) take `{ jobId }` directly, **not** `{ data: { jobId } }`.
- Server uses `req.log` for logging — never `console.log`.
- All routes are matched by the global proxy at `localhost:80` based on each artifact's `artifact.toml` paths. The API owns `/api`; the marketplace owns `/`.
- **`lib/api-zod` codegen pitfall:** `lib/api-zod/src/index.ts` must only re-export `./generated/api`. Re-exporting `./generated/types` causes TS2308 duplicate-export errors because zod schemas already create both value + type symbols. The orval post-script `lib/api-spec/fix-api-zod-index.mjs` rewrites this file after codegen — do not hand-edit.
- Phase 1 financials use **AED** with **5% VAT** on invoices and a **10% platform fee** on milestone releases. Money is stored as `numeric(12,2)` (Drizzle `decimal`) — convert with `Number(row.amount)` and persist as `String(value)`.
- Stripe is mocked. Funding a milestone synthesises a `pi_mock_…` intent id and immediately records `payments.status = "held"`. Approval flips it to `"released"`. There are no webhooks.

## Phase 2 — Realtime, disputes, legal, settings, uploads, analytics

Phase 2 is a backend-only expansion. No frontend rebuild; existing Phase 1 endpoints are untouched.

### New tables (lib/db)
- `disputes`, `dispute_messages` — contract-scoped disputes with thread.
- `legal_documents`, `consents` — versioned EN/AR Terms/Privacy/NDA + acceptance log.
- `platform_settings` — typed jsonb key/value with `is_public` flag (`integer` 0/1).
- `attachments` — uploaded file metadata (sha256, mime, size, kind, url).

### Realtime (Socket.IO)
- `src/index.ts` wraps the express app in `http.createServer(app)` and `initRealtime(server)` attaches Socket.IO at path **`/api/socket.io`** (must include the `/api` prefix because the global proxy routes by path).
- JWT auth: client passes `auth: { token }` (or `?token=` query). On connect, the socket joins `user:<uid>` room. Conversation participants can also `socket.emit("conversation:join", convId)` to receive `message:new` events for that conversation.
- `lib/realtime.ts` exports `getIO()`, `emitToUser(userId, event, payload)`, `emitToConversation(convId, event, payload)`.
- `lib/notify.ts` `notify({ userId, kind, title, body, link })` writes the notification row **and** emits `notification:new` to the recipient. **All** notification insert sites have been migrated — never call `db.insert(notificationsTable)` directly outside `lib/notify.ts`.

### Notifications
- `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`, `POST /notifications/read-all`.

### Disputes
- `POST /contracts/:id/disputes` — party of contract only; optional `milestoneId` must belong to the contract. Notifies the other party.
- `GET /disputes` (mine), `GET /disputes/:id`, `GET/POST /disputes/:id/messages`.
- Admin: `GET /admin/disputes`, `PATCH /admin/disputes/:id` (`status`: open/under_review/resolved/rejected/closed + optional `resolutionNotes`). **MVP keeps escrow conservative** — admin status changes do not move money. Refund/release flows remain on the existing milestone endpoints.

### Reviews tightened to contracts
- `POST /reviews` now requires a **completed contract** between `fromUserId` and `toUserId` for the given `jobId`. Backward-compatible with the existing seed because seeded reviews bypass the route. Frontend smoke tests that posted reviews without contracts will now 403 — this is intentional.
- New: `GET /reviews/summary?userId=` returns `{ ratingAvg, ratingCount, distribution: {1..5} }`.

### Search & ranking
- `GET /jobs` accepts `sort=newest|budget_high|relevance` and `limit/offset` (raw query, since `ListJobsQueryParams` zod schema doesn't include them).
- `GET /freelancers` accepts `sort=relevance|rating|rate_low|rate_high|newest`. Relevance score = `(avg_rating * 2) + review_count + recency_boost (created < 30d)`. Score is also returned per row for debugging.

### File uploads
- `POST /uploads` (multipart, field `file`, max **10 MB**, allowed mime list in `routes/uploads.ts`). Stores to `artifacts/api-server/uploads/`, sha256-hashed, registered in `attachments`. Returns `{ id, url, mimeType, sizeBytes, sha256 }`.
- `GET /uploads/:filename` streams with stored mime/disposition. `GET /uploads/meta/:id` returns the metadata row (auth-only).

### Legal pages + consent
- `GET /legal/:slug?lang=en|ar` returns the current published doc with `body`/`title` resolved by lang plus both EN/AR fields.
- Admin: `GET /admin/legal/:slug/versions`, `POST /admin/legal` (publish — flips prior `is_current=false` and inserts new version, in a tx).
- `POST /consents` (body `{ documentSlug }`) records acceptance with ip/UA. `GET /me/consents` lists.

### Platform settings
- `GET /settings/public` — whitelisted (`is_public=1`) keys only: `platform_fee_pct`, `vat_pct`, `default_currency`, `support_email`, `max_upload_mb`.
- Admin: `GET /admin/settings`, `PUT /admin/settings/:key` (body `{ value }`). Audit-logged.
- Seeded values: `platform_fee_pct=10`, `vat_pct=5`, `default_currency=AED`, `support_email=support@khidma.ae`, `max_upload_mb=10`, `min_payout_aed=100` (private).

### Admin analytics
- `GET /admin/analytics/overview` — extends Phase 1 stats with `escrowHeldAed`, `pendingPayoutsAed`, `walletAvailableAed/PendingAed`, `openDisputes`, `reviews`.
- `GET /admin/analytics/timeseries?metric=signups|payments|disputes|contracts&days=N` — generates a daily series via `generate_series`. Returns `{ metric, days, points: [{date, value}] }`.
- `GET /admin/analytics/top-categories`, `/admin/analytics/top-freelancers`.

### Audit log filtering & export
- `GET /admin/audit-logs` accepts `userId, entityType, entityId, action, fromDate, toDate, limit, offset` filters via `buildAuditLogConditions()`.
- `GET /admin/audit-logs.csv` streams a CSV of the same filters.

### Smoke test
- `node artifacts/api-server/scripts/smoke-phase2.mjs` runs 35 end-to-end checks covering login, settings, legal, consents, notifications, search/ranking, reviews, disputes lifecycle, analytics, audit, uploads, settings update, Socket.IO connect. Last run: 35/35 pass.

### Phase 2 — known gaps / deferred
- **OpenAPI/codegen not yet extended** (T114): Phase 2 endpoints work via direct Zod validation in each route file but `lib/api-spec/openapi.yaml` does not yet describe them. Frontend clients consuming new endpoints must hand-write the call until the OpenAPI spec is updated and `pnpm --filter @workspace/api-spec run codegen` is rerun. All Phase 1 endpoints remain in the spec and continue to generate hooks/types.
- Disputes admin status changes do **not** move money in this MVP; treat resolution notes as the source of truth and adjust escrow via the existing milestone endpoints.

## Phase 3 — scoring, recommendations, alerts, reporting, SEO, hardening

Phase 3 extends the Phase 1/2 stack additively. **No rebuild, no breaking changes** to existing routes or schemas.

### Schema additions (`drizzle-kit push` only — no destructive migrations)
- `freelancer_profiles`: `trust_score int default 0`, `last_score_at timestamptz` + index `freelancer_profiles_trust_score_idx (trust_score desc)`.
- `client_profiles`: `quality_score int default 0`, `last_score_at timestamptz` + index `client_profiles_quality_score_idx (quality_score desc)`.
- `jobs`: indexes on `status`, `created_at desc`, `category_id`.
- New tables `saved_searches` (`user_id, name, query jsonb, notify, last_run_at`) and `saved_search_alerts` (`saved_search_id, job_id, notified_at`).
- Schema files use camelCase filenames matching the Phase 2 convention (e.g. `freelancerProfiles.ts`, `savedSearches.ts`). All re-exported from `lib/db/src/schema/index.ts`.

### Scoring (`lib/scoring.ts`)
- `recomputeFreelancerTrust(uid)` and `recomputeClientQuality(uid)` write to the `*_score` and `last_score_at` columns. Inputs are clamped 0–100.
- Freelancer trust signals: completed contracts, dispute count (penalty), avg review rating × 10, verification bonus, on-time milestone-approval ratio.
- Client quality signals: contracts funded, on-time approvals, dispute history, avg rating from freelancers, verification bonus.
- `recomputeAll()` iterates all profiles and is exposed as `POST /admin/scoring/recompute-all` (admin-only, audit-logged).
- **Triggers (best-effort, dynamic-imported so failures never break the request):** `routes/contracts.ts` on `complete` + auto-complete on milestone approval; `routes/reviews.ts` after create; `routes/verifications.ts` after approve; `routes/disputes.ts` after resolve/rejected.
- Read-only: `GET /freelancers/:id/trust` and `GET /clients/:id/quality`.

### Matching (`lib/matching.ts`)
- `computeMatchScore(jobId, freelancerId)` returns `{ total, components }` weighted: skills overlap 40, budget fit 15, freelancer trust 20, rating count 10, location/category fit 10, recency boost 5.
- `topFreelancersForJob(jobId, limit)`, `topJobsForFreelancer(freelancerId, limit)`, `similarFreelancers(freelancerId, limit)`.
- Endpoints: `GET /jobs/:id/matches` (job owner OR admin only — non-owners get 403), `GET /me/recommended-jobs` (freelancer), `GET /me/recommended-freelancers` (client, aggregated across their open jobs), `GET /freelancers/:id/similar` (public), `GET /match/jobs/:jobId/freelancers/:freelancerId` (admin diagnostic).

### Saved searches + alerts
- `GET / POST / DELETE /me/saved-searches` (auth). Stored `query` is freeform JSON (`q`, `category`, `skill`, `budget`, etc).
- `GET /me/saved-searches/:id/preview` runs the search live against `/jobs` filters.
- `POST /admin/saved-searches/run` sweeps all saved searches with `notify=true`, finds jobs created since `last_run_at`, inserts into `saved_search_alerts`, and calls `notify({ kind: "saved_search_match", link: "/jobs?..." })` per match. Returns `{ searchesScanned, matchesNew }`.

### Advanced admin reporting (`routes/reports.ts`)
- `GET /admin/reports/revenue?from=&to=` — sums GMV, platform fees, freelancer net, VAT (from invoices.issued_at) over the window.
- `GET /admin/reports/payouts?from=&to=` — count + total grouped by status (uses `payouts.requested_at`, **not** `created_at` which doesn't exist on that table).
- `GET /admin/reports/cohorts?metric=signups|first_contract&months=N` — monthly cohorts via `date_trunc('month', ...)` and `generate_series`.
- `GET /admin/reports/top-clients` and `/top-freelancers` — by GMV.
- `GET /admin/reports/funnel` — signups → first proposal → first contract → completed contracts.
- All require `requireRole("admin")` (verified 403 for non-admin in smoke).

### SEO / public endpoints
- `GET /api/sitemap.xml` and `/api/robots.txt` (5-min cache). Sitemap enumerates open jobs, public freelancers, legal slugs.
- `GET /public/jobs/:id` returns SEO-safe payload `{ id, title, description, currency, budget, skills, seo: { title, description } }` — no PII, no proposals.
- `GET /public/freelancers/:id` returns minimal public profile.
- `GET /public/categories?lang=en|ar`.

### Localization
- `?lang=en|ar` accepted on `/meta/categories` and `/public/categories`. Server returns enriched rows with both `nameEn`/`nameAr` plus a resolved `name` field. The `ListCategoriesResponse` Zod (api-spec) only validates the canonical subset; the resolved `name` is added after validation so generated clients keep working.
- Server returns raw monetary/date values; UI is responsible for `Intl.NumberFormat`/`Intl.DateTimeFormat` formatting.

### Caching (`lib/cache.ts`)
- Tiny in-process TTL cache. Wired:
  - `/meta/categories` (lang-aware key) — 60 s, invalidated implicitly by TTL.
  - `/meta/skills` — 60 s.
  - `/settings/public` — 60 s, **invalidated on `PUT /admin/settings/:key`**.
  - `/legal/:slug` — 60 s.
  - `/public/categories` — 60 s.
  - sitemap — 5 min.
- Cache is process-local only — fine for single-instance dev; replace with Redis if horizontally scaled.

### Security hardening
- `lib/security.ts` — helmet-equivalent header middleware (HSTS in prod, `X-Content-Type-Options`, frameguard, referrer-policy, CORP). Verified via `headers.x-content-type-options === "nosniff"` in smoke.
- `lib/rateLimit.ts` — sliding-window in-memory limiter applied to `/auth/register`, `/login`, `/refresh`, `/forgot-password`, `/reset-password`.
- `app.ts`: `trust proxy 1`, `X-Request-Id` middleware (UUID per request, surfaced in pino logs), JSON body limit **1 MB** with explicit 413 handler. Multer uploads keep their existing 10 MB limit.

### Production readiness
- `lib/env.ts` — Zod-validated env at boot. Fails fast on missing `DATABASE_URL` / `SESSION_SECRET`.
- `GET /healthz` — liveness only. `GET /readyz` — runs `SELECT 1` against Postgres and returns `{ status: "ready", db: "ok" }`.
- `index.ts` registers SIGTERM/SIGINT handlers that close the HTTP server and call `shutdownRealtime()` (added to `lib/realtime.ts`) to drain Socket.IO.
- pino still uses pretty in dev; production uses default JSON output.

### Smoke test
- `node artifacts/api-server/scripts/smoke-phase3.mjs` — 37 end-to-end checks covering health, security headers, localized categories, sitemap/robots, public job + freelancer, scoring recompute + read, recommendations + similar, job-match authorization, saved-searches CRUD + preview + admin sweep, every admin report (revenue/payouts/cohorts ×2/top-clients/top-freelancers/funnel), 403 enforcement on reports for non-admin, 1 MB body limit, match diagnostic (admin-only with non-admin 403). **Last run: 37/37 pass.**
- Phase 2 `smoke-phase2.mjs` (35/35) still passes — Phase 3 is fully additive.

### Phase 3 — code review hardening (post-architect fixes)
- **Saved-search sweep is lossless:** rewritten as ascending-id cursor pagination (PAGE=100, MAX_PAGES_PER_SEARCH=20). No matching jobs can be skipped between sweeps. `cursor` is only persisted forward.
- **Saved-search dedup is race-safe:** `saved_search_alerts` now has `UNIQUE(saved_search_id, job_id)` (`saved_search_alerts_pair_uidx`). The sweep does a single `INSERT ... ON CONFLICT DO NOTHING RETURNING job_id`, so concurrent sweeps cannot create duplicate alerts/notifications.
- **Score recompute triggers are truly fire-and-forget:** `lib/scoring.ts` exposes `recomputeForUserAsync(userId, role)` and `recomputePairAsync(freelancerUserId, clientUserId)` which schedule via `setImmediate`. All four trigger sites (contracts.complete, milestone.approve auto-completion, reviews.create, disputes.resolve|rejected, verifications.approve) now call these helpers and return immediately. Failures log via `console.warn` and never propagate.
- **Match diagnostic locked down:** `GET /match/jobs/:jobId/freelancers/:freelancerId` now requires `requireRole("admin")`. Non-admin auth is 403.
- **Recommended freelancers filter:** `/me/recommended-freelancers` only considers the client's `status='open'` jobs (matches the original spec).
- **Legal cache invalidation:** `POST /admin/legal` calls `cacheDeletePrefix(\`legal:${slug}:\`)` after publish so freshly published versions appear immediately.

## Phase 4 — production prep, mobile API, payment abstraction, monetization

Phase 4 is fully additive on top of Phases 1–3. **No rebuild, no breaking changes** to existing routes or schemas. All Phase 1–3 smoke tests still pass (35/35 + 37/37). Phase 4 routes return a mobile-friendly envelope; legacy Phase 1–3 routes are untouched.

### Schema additions (drizzle-kit push)
- New tables: `device_tokens`, `escrow_events`, `payout_batches`, `payout_batch_items`, `featured_listings`, `subscription_plans`, `user_subscriptions`, `moderation_reports`, `currencies`, `fx_rates`.
- Additive columns:
  - `invoices`: `trn`, `place_of_supply` (default `'AE'`), `reverse_charge` (bool), `invoice_type_code` (`'standard'`|`'simplified'`).
  - `milestones`: `escrow_state` (mirrors status; new states: `partial_released`, `dispute_held`, `expired_returned`).

### Mobile API standards (`lib/apiResponse.ts`)
- All NEW Phase 4 routes use `respond(res, data, meta?)` and `respondError(res, status, code, message)` producing `{ data, meta? }` / `{ error: { code, message } }` envelopes.
- `parsePagination(query)` + `paginate(page, perPage, total)` produce `{ page, perPage, total, hasMore }` meta.
- Legacy Phase 1–3 routes deliberately keep their bare-array/object shapes for backward compatibility with the existing marketplace frontend.
- `app.ts`: every response now sets `X-API-Version: 4` and CORS exposes `X-Request-Id` + `X-API-Version`.

### Device tokens + push (`lib/push.ts`)
- `sendPush(userId, payload)` is a no-op stub that logs and returns `{ delivered: 0, attempted: tokens.length }`. Future-pluggable for FCM/APNs/Expo.
- Routes (auth): `POST /me/devices`, `GET /me/devices`, `DELETE /me/devices/:id`. List redacts the token (`first8…`).
- Idempotent: re-registering the same token by the same user updates `last_seen_at`. Re-registering by a different user → 409.
- `lib/notify.ts` now schedules `sendPush` via `setImmediate` after the socket emit — best-effort, never blocks the request, never throws.

### Payment gateway abstraction (`lib/payments/`)
- `gateway.ts` — `PaymentGateway` interface (`name`, `configured`, `createIntent`, `capture`, `refund`, `webhookVerify`).
- Adapters: `mock.ts` (default; mirrors current behaviour), `stripe.ts`, `paytabs.ts`, `telr.ts` — all real-gateway adapters return `not configured` until env keys are set. **No live charges anywhere.**
- `index.ts` exports `getActiveGatewayName()` (reads `payment_gateway` setting, default `mock`), `getGatewayByName(name)`, `listGateways()`.
- Endpoints: `GET /payments/gateway` (public — `{ active, available[] }`), `POST /admin/payments/gateway` (set active), `POST /payments/webhook/:gateway` (stub verify), `POST /admin/payments/refund`.

### Advanced escrow (`lib/escrowEvents.ts` + `routes/escrowAdmin.ts`)
- `recordEscrowEvent({ contractId, milestoneId, paymentId, fromState, toState, amount, currency, actorUserId, reason, metadata })` writes to `escrow_events`. Emitted on every Phase 4 admin transition AND auto-fired on dispute open when a milestone is targeted.
- Admin-only routes (return envelope):
  - `POST /admin/escrow/milestones/:id/partial-release` — releases a portion to the freelancer wallet (uses existing `releaseToWallet`), marks milestone `escrowState='partial_released'`. Validated against held amount; rejects if milestone not in `funded`/`submitted`.
  - `POST /admin/escrow/milestones/:id/refund` — marks milestone `refunded`, payment `refunded`, records event.
  - `POST /admin/escrow/milestones/:id/hold-for-dispute` — sets `escrowState='dispute_held'`.
  - `GET /admin/escrow/events?milestoneId=&contractId=` — audit feed (200 latest).

### Payout batches (`routes/payoutBatches.ts`)
- `POST /admin/payout-batches` — creates a draft batch from currently `requested` payouts; optional filters `minAmount`, `freelancerIds`. In a single tx: insert batch, insert items, flip payouts to `batched`. 400 `no_candidates` when nothing matches.
- `POST /admin/payout-batches/:id/process` — flips items + underlying payouts to `completed`, stamps `processed_at/by`.
- `GET /admin/payout-batches` (paginated), `GET /admin/payout-batches/:id` (joins users), `GET /admin/payout-batches/:id/export.csv` — CSV with payout/freelancer/amount columns; sets Content-Disposition for download.

### Featured listings (`routes/featured.ts`)
- Admin: `POST /admin/featured` (kind `job|freelancer`, targetId, startsAt?, endsAt, optional sponsor/payment), `DELETE /admin/featured/:id`, `GET /admin/featured` (returns `activeCount` in meta).
- Public: `GET /featured?kind=` returns currently active (now between `starts_at` and `ends_at`).
- **Phase 3 ranking unchanged** — no sort/filter mutation in `/jobs` or `/freelancers` to keep the Phase 3 ranking smoke green.

### Subscriptions (`routes/subscriptions.ts`)
- Public: `GET /subscription-plans` (active only). Admin: `GET/POST /admin/subscription-plans`, `PUT /admin/subscription-plans/:id`.
- Self-serve: `GET /me/subscription`, `POST /me/subscription` (subscribes to a plan; supersedes any active row), `POST /me/subscription/cancel`.
- Seeded plans: `freelancer_pro` (AED 99/mo) and `client_business` (AED 299/mo) with bilingual descriptions and feature flags.

### VAT/tax invoice improvements (`lib/escrow.ts` + `routes/invoicesTax.ts`)
- `generateInvoice` now accepts `trn`, `placeOfSupply` (default `AE`), `reverseCharge`, `invoiceTypeCode` (default `standard`). Existing call sites continue to work (all four are optional).
- `GET /invoices/:id/tax-pdf-data` — bilateral access (client+freelancer+admin) returns a JSON snapshot for client-side PDF generation: invoice numbers/totals, bilingual reverse-charge note text, platform TRN (read from `platform_settings.platform_trn`).

### Multi-currency (`lib/currency.ts`)
- Seeded `currencies`: AED (default), USD, EUR, SAR, GBP with EN/AR names + symbol + decimals.
- Seeded `fx_rates`: AED↔USD/EUR/SAR/GBP and reverse pairs.
- Endpoints: `GET /currencies`, `GET /fx-rates?base=&quote=`, `GET /fx-convert?amount=&from=&to=`, `POST /admin/fx-rates` (manual upsert), `POST /admin/fx-rates/refresh` (no-op stub returning provider+age).
- Helper `convert(amount, from, to)`: identity when `from===to`; uses latest cached `fx_rates`; returns `null` if no rate.

### Admin reconciliation (`routes/reconciliation.ts`)
- `GET /admin/reconciliation/daily?date=YYYY-MM-DD` — payments captured/fees/refunded, payouts initiated/completed, wallet credits/debits, `discrepancy` boolean.
- `GET /admin/reconciliation/wallets` — sum(`available + pending`) vs sum(`wallet_transactions.amount`); reports up to 500 row-level mismatches (>0.05 AED tolerance).
- `GET /admin/reconciliation/escrow` — sum of `held` payments vs sum of `funded` milestones; `reconciled` flag (<0.5 AED).

### Moderation queue (`routes/moderation.ts`)
- `POST /reports` (any auth user) — `targetKind` ∈ `job|profile|review|message|proposal`, `targetId`, `reason`, `details?`.
- `GET /me/reports` — own filed reports.
- Admin: `GET /admin/moderation?status=&kind=` (paginated meta), `POST /admin/moderation/:id/resolve` (`action` ∈ `approve_keep|hide|warn|ban`, `notes?` — MVP records the decision; auto-ban not wired yet).

### Production monitoring (`lib/metrics.ts` + `routes/metrics.ts`)
- `metricsMiddleware` registered in `app.ts` after the request-id middleware. Tracks `requestsTotal`, `requestsByStatusClass`, `errors5xx`, `slowRequests` (>1s), and a sliding window of latencies for p50/p95/p99.
- Slow requests (>1s) are logged at `warn` via the existing pino-http logger.
- `GET /metrics` (admin-only) returns `{ uptimeSec, memoryRssMb, requests, errors5xx, slowRequests, latency: { p50, p95, p99, samples } }`.

### Phase 4 smoke
- `node artifacts/api-server/scripts/smoke-phase4.mjs` — **61 end-to-end checks** covering envelope shape + headers, device CRUD + idempotency + cross-user 409, gateway list/set/webhook/refund, featured admin CRUD + public list + bad-range 400, subscription plan list + subscribe + supersede + cancel, invoice tax-pdf-data including platform TRN, currencies + fx single/list/convert/identity/upsert/refresh, reconciliation daily/wallets/escrow + 403 for non-admin, moderation report file/list/resolve, metrics admin-only, escrow events admin-only, payout batches no-candidates + paginated list, plus backward-compat checks against `/meta/categories` and `/auth/me`. **Last run: 61/61 pass.** Phase 2 (35/35) and Phase 3 (37/37) still pass — Phase 4 is additive.

## Phase 5 — multi-gateway payments (real SDKs + manual bank transfer)

Phase 5 is fully additive on top of Phases 1–4. **No rebuild, no breaking changes.** All Phase 1–4 routes (including the Phase 1 `POST /payments/create-intent` mock and the Phase 4 `POST /admin/payments/refund` + `GET /payments/gateway`) are untouched. Phase 5 introduces a payment-gateway abstraction with real adapters, idempotency, webhook dedup + signature verification, and manual bank-transfer proof workflow.

### New schema (lib/db/src/schema)
- `payment_gateways` — admin-managed registry: `name` (`stripe|paytabs|telr|manual|mock`), `providerCode`, `isActive`, `mode` (`TEST|LIVE`), `supportedCurrencies` (text[]), `configJson`, `sortOrder`. Seeded with all 5 adapters; only `manual` is active by default.
- `payment_transactions` — per-attempt: `gateway`, `userId` (payer), `paymentPurpose` (`milestone_funding|subscription|featured|other`), `contractId?`, `milestoneId?`, `amount` (numeric), `currency`, `status` (`INITIATED|PENDING|REQUIRES_ACTION|PAID|FAILED|REFUNDED`), `gatewayReference` (the gateway-assigned id, e.g. `pi_…` for Stripe or `manual_<uuid>` for manual), `idempotencyKey`, `metadata` (jsonb — admin-entered `bankReference` for manual approvals lives here, NOT in `gatewayReference`), `failureReason`, `proofAttachmentId?`. **UNIQUE** on `(gateway, idempotency_key)` and **UNIQUE** on `(gateway, gateway_reference)` (Postgres NULL-distinct, so multiple in-flight INITIATED rows with NULL ref are fine; once a ref is assigned no two rows can share it within a gateway, making webhook lookup unambiguous).
- `payment_intents` — gateway intent/session refs: `transactionId` (FK), `intentId`, `clientSecret?`, `redirectUrl?`, `status`, `rawResponse`. Allows multiple attempts per transaction.
- `payment_webhooks` — raw events + idempotency: `gateway`, `eventId`, `eventType`, `signatureValid`, `payload`, `processed`, `processingError?`. UNIQUE on `(gateway, event_id)` for dedup.
- `escrow_events` (existing Phase 4) is reused as the escrow ledger — manual approval fires `held` event via `markTransactionPaidAndFundEscrow()`.

### Gateway adapter interface (`lib/payments/gateway.ts`)
Each adapter implements: `name`, `configured`, `supportedCurrencies`, `mode`, `createIntent({ amount, currency, idempotencyKey, customerEmail, customerName, returnUrl, cancelUrl, callbackUrl, metadata, description })`, `webhookVerify({ rawBody, headers })`. Result types include `{ intentId, clientSecret?, redirectUrl?, status, rawResponse }` and `{ ok, eventId, eventType, signatureValid, payload, gatewayReference?, mappedStatus? }`. `mappedStatus` is one of the canonical PT statuses.

### Adapters (`artifacts/api-server/src/lib/payments/`)
- `stripe.ts` — **real `Stripe` SDK** (`pnpm add stripe`). `createIntent` calls `stripe.paymentIntents.create(...)` with `idempotencyKey` header. `refund` calls `stripe.refunds.create`. `webhookVerify` calls `stripe.webhooks.constructEvent(rawBuffer, signatureHeader, STRIPE_WEBHOOK_SECRET)`. `configured` iff `STRIPE_SECRET_KEY` is set.
- `paytabs.ts` — **real `fetch` POST** to `https://secure.paytabs.com/payment/request` (region selectable via `PAYTABS_REGION`: `ARE|SAU|EGY|JOR|OMN|GLOBAL`) with the documented `profile_id`/`tran_type`/`tran_class`/`cart_*`/`customer_details`/`callback`/`return` body. Webhook verifies HMAC-SHA256 over the canonical JSON payload using `PAYTABS_SERVER_KEY` (TODO note for any per-merchant signing-secret variants).
- `telr.ts` — **real `fetch` POST** to `https://secure.telr.com/gateway/order.json` with `ivp_method=create`, `ivp_store`, `ivp_authkey`, `ivp_test`, `ivp_amount`, `ivp_currency`, `ivp_desc`, `ivp_cart`, `return_*`. Webhook handler reads `tran_status` and maps to canonical status.
- `manual.ts` — env-driven bank instructions (`MANUAL_BANK_ACCOUNT_NAME|BANK_NAME|IBAN|SWIFT`) + per-tx `manual_<uuid>` reference. Always `configured: true`. Webhook is admin-driven (no external callback).
- `mock.ts` — kept and updated to satisfy the new interface; webhook accepts `{ id, type, gatewayReference, mappedStatus }` so the smoke can drive PT through PAID.
- `index.ts` registry exports `getGateway(name)`, `ALL_GATEWAY_NAMES`, `getManualBankDetails()`.
- `processing.ts` exposes `markTransactionPaidAndFundEscrow({ transactionId, paidAt, gatewayReference?, bankReference?, actorUserId, reason })`. Uses a **conditional UPDATE** (`WHERE status IN (INITIATED, PENDING, REQUIRES_ACTION)`) to claim the transaction atomically before inserting the `payments` row, generating the invoice, calling `addPendingBalance`, and recording an `escrow_events {toState: 'held'}` row. Idempotent: returns `false` if another worker already claimed the row.

### Routes (`artifacts/api-server/src/routes/`)
- `paymentsV2.ts`:
  - `GET /payments/gateways` — public, returns the configured registry rows merged with adapter `configured` flag, supportedCurrencies, mode.
  - `POST /payments/intents` — auth required. Body: `{ gateway, paymentPurpose, contractId?, milestoneId?, amount, currency, idempotencyKey?, customerEmail?, returnUrl?, cancelUrl?, callbackUrl?, description?, metadata? }`. Replays existing transaction on idempotency-key match (returns `replayed: true`). Calls adapter `createIntent`, persists transaction + intent rows, returns `{ transaction, intent, bankDetails? }`. Unconfigured gateway → `503 gateway_not_configured`.
  - `GET /payments/transactions` — auth, paginated, scoped to caller (admin sees all).
  - `GET /payments/transactions/:id` — auth, owner-or-admin. Returns `{ transaction, intents[], webhooks[] (admin only) }`.
  - `POST /payments/manual/submit-proof` — owner-only. Body: `{ transactionId, attachmentId, note? }`. Marks PT `PENDING`, attaches proof.
  - Webhooks: `POST /payments/stripe/webhook`, `POST /payments/paytabs/callback`, `POST /payments/telr/callback`, `POST /payments/mock/webhook`. All four routes are mounted with path-scoped `express.raw({type:'*/*',limit:'1mb'})` BEFORE the global `express.json` so HMAC verification runs over the exact bytes the gateway signed (re-serializing via `JSON.stringify(req.body)` would break HMAC). Each handler runs adapter `webhookVerify`, then **hard-fails (400) when `signatureValid !== true` for stripe/paytabs/telr** — the unverified event is still persisted (`processed=false`, `processError="signature verification failed"`) for audit, but no PT state mutation runs. Verified events are deduped by inserting into `payment_webhooks` and catching the UNIQUE-violation on `(gateway, event_id)`; duplicates short-circuit with `{received:true, duplicate:true}`. First delivery with `mappedStatus === 'PAID'` calls `markTransactionPaidAndFundEscrow`. The mock gateway is intentionally unsigned and bypasses the security gate (dev-only).
- `paymentsAdmin.ts` (mounted under `/admin`):
  - `GET /admin/payments/transactions` — filters: `gateway`, `status`, `paymentPurpose`, `payerId`, `dateFrom`, `dateTo`, paginated.
  - `GET /admin/payments/webhooks` — filters: `gateway`, `processed`, paginated.
  - `POST /admin/payments/manual/approve` — body: `{ transactionId, bankReference?, note? }`. State guard: only `PENDING|REQUIRES_ACTION|INITIATED`, else `409 invalid_state`. Calls `markTransactionPaidAndFundEscrow`.
  - `POST /admin/payments/manual/reject` — body: `{ transactionId, reason }`. Marks PT `FAILED`.
  - `GET /admin/payments/summary` — financial dashboard: counts by status, totals by gateway/currency, pending manual queue depth, last 7-day volume.
  - `GET /admin/payments/gateways` — full registry rows (includes inactive).
  - `POST /admin/payments/gateways` — admin insert.
  - `PATCH /admin/payments/gateways/:id` — toggle `isActive`, `mode`, `configJson`, `sortOrder`.
- All Phase 5 mutations call `audit()`. Stripe raw-body middleware is registered in `app.ts` BEFORE `express.json()` and is path-scoped to `/api/payments/stripe/webhook` so other routes still receive parsed JSON.

### Phase 5 env
`.env.example` lists: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `PAYTABS_PROFILE_ID`, `PAYTABS_SERVER_KEY`, `PAYTABS_REGION`, `TELR_STORE_ID`, `TELR_AUTH_KEY`, `TELR_TEST_MODE`, `MANUAL_BANK_ACCOUNT_NAME`, `MANUAL_BANK_NAME`, `MANUAL_BANK_IBAN`, `MANUAL_BANK_SWIFT`. None are required for the test environment — gateways simply report `configured: false` and `POST /payments/intents` returns `503 gateway_not_configured`.

### Phase 5 smoke
- `node artifacts/api-server/scripts/smoke-phase5.mjs` — **39 end-to-end checks** covering: gateway listing shape (5 adapters, manual active+configured), unconfigured Stripe/PayTabs/Telr → clean 503, mock create-intent + idempotency replay (same key → same tx id, `replayed:true`), manual create-intent returns bank details, proof upload via `/uploads`, owner-only submit-proof (non-owner → 403/404), admin approve transitions PT to PAID, re-approve already-PAID → 409 `invalid_state`, admin reject transitions PT to FAILED, mine-vs-admin transactions scoping, admin filters + summary shape (verifies `paid >= 1`), non-admin → 403 on summary, **security regressions**: approved manual tx keeps `manual_<uuid>` as `gatewayReference` while the human bank reference lives in `metadata.bankReference`, PayTabs and Telr forged callbacks → 400/503 with no state change, Stripe webhook bad signature → 400/503, mock webhook duplicate event id → `duplicate:true` and persisted exactly once, admin gateway PATCH toggle (Stripe `isActive` → true → revert), legacy `POST /payments/create-intent` still reaches its Phase 1 handler. **Last run: 39/39 pass.** Phase 4 (61/61), Phase 3 (37/37) and Phase 2 (35/35) still pass — Phase 5 is additive (cumulative: 172/172).

### Phase 5 — known gaps / deferred
- **Frontend pages explicitly deferred** to a follow-up session: payment method picker, manual proof upload UX, admin payments dashboard, gateway-config screens. Backend routes are complete and stable.
- **OpenAPI/codegen not extended for Phase 5** (same precedent as Phase 2–4): all Phase 5 routes are direct Zod-validated handlers.
- **PayTabs HMAC verification covers the documented `signature` header**; some merchant accounts use a per-channel secret rather than the server key — adapter has a TODO noting where to swap if needed.
- **Telr's webhook signature verification is best-effort** based on the public docs (no shared HMAC secret in the standard flow); production deployments should additionally pin `tran_ref` lookups to the original `cart_id` (already done) and consider IP allow-listing.
- **No background reconciliation job yet** — `payment_transactions` left in `INITIATED|PENDING|REQUIRES_ACTION` for >24h are not auto-failed. Add a cron in Phase 6 if desired.

### Phase 4 — known gaps / deferred
- **OpenAPI/codegen not extended for Phase 4** (same precedent as Phase 2/3): all Phase 4 routes are direct Zod-validated handlers; mobile/web clients consuming them must hand-write the call.
- ~~**Real payment gateways (Stripe, PayTabs, Telr) are stubs.**~~ → **Resolved in Phase 5.** Stripe now uses the real SDK with webhook signature verification; PayTabs/Telr issue real HTTP requests; Manual bank transfer with proof upload + admin approve/reject is fully wired.
- **`sendPush` is a no-op stub.** No FCM/APNs/Expo client wired yet — registering devices and inserting notifications works, the push fan-out logs and returns `{ delivered: 0 }`.
- **FX refresh is a stub.** No external provider wired; `POST /admin/fx-rates/refresh` only reports the latest rate age. Use `POST /admin/fx-rates` to upsert manually.
- **Subscriptions don't take real money.** `/me/subscription` records the row; no charge, no proration, no auto-renew enforcement.
- **Featured listings are not (yet) reflected in `/jobs` and `/freelancers` ranking** to avoid disturbing the Phase 3 relevance smoke. Listing-side surfacing can be added once a regression baseline is captured.
- **Metrics + rate-limit + cache remain in-process.** Move to Redis/Prometheus before horizontal scale-out.
- **Moderation actions don't enforce yet.** `hide/warn/ban` only stamp the report — they don't actually toggle user `status` or hide content.

### Phase 3 — known gaps / deferred
- **OpenAPI/codegen not extended for Phase 3** (T213, same precedent as Phase 2): scoring, matching, recommendations, saved-searches, reports, public, sitemap and health endpoints are not described in `lib/api-spec/openapi.yaml`. Frontends consuming them must hand-write fetch calls. All Phase 1 hooks remain valid.
- **Cache and rate-limit are in-process.** Single-instance only — move to Redis before horizontal scale-out.
- **Saved-search sweep is on-demand.** No internal cron yet — call `POST /admin/saved-searches/run` from an external scheduler (or add a `setInterval` if desired).
- **Match scoring is computed live.** No materialised cache yet; fine at current data volumes (37 ms typical for diagnostic call). Add a background job + `match_cache` table if N×M grows beyond ~10k pairs.

## Phase 6 — Admin control panel backend (route layer + RBAC + content)

Backend foundation for the unified admin control panel (frontend pages deferred to a follow-up session). All new admin routes are gated by both `requireAuth` and `requirePermission(resource, action)` from `lib/permissions.ts`.

### Granular admin RBAC
- New nullable column `users.admin_role` for staff sub-roles. NULL = not staff. Values: `super_admin`, `admin`, `moderator`, `finance_admin`, `content_manager`, `support_agent`. The legacy `users.role='admin'` flag is treated as `admin_role='admin'` if the column is NULL, so all pre-existing admin endpoints keep working at the same access level (NOT super_admin — least-privilege).
- `lib/permissions.ts` exports `ADMIN_ROLES`, `PERMISSIONS` (resource × action matrix), `effectiveAdminRole(user)`, `hasPermission(user, resource, action)`, and Express middleware `requirePermission(resource, action)` (403 with `{error,resource,action}`). Only `super_admin` bypasses every check; other roles (including `admin`) are matrix-driven. Unknown `adminRole` values fail closed (deny everything).
- Seed promotes `admin@khidma.ae` to `admin_role='super_admin'`.
- **Privilege-escalation hardening on `PATCH /admin/users/:id`:** changing the public `role` or staff `adminRole` of any user requires `admin_users:write` (only `super_admin` and `admin` adminRoles), granting `adminRole='super_admin'` requires the caller already be `super_admin`, and a user can never change their own `role` or `adminRole` regardless of permission.

### Audit log v2
- `audit_logs` gained `old_value jsonb` and `new_value jsonb`. The `audit()` helper now accepts optional `oldValue` + `newValue` params (existing call sites compile unchanged) so every admin mutation persists a clean before/after diff.

### New admin tables (`lib/db/src/schema`)
- `admin_notes` (subjectKind, subjectId, authorId, body, createdAt) — internal staff notes attached to any entity (currently exposed for users).
- `cms_pages` (slug+locale UNIQUE, title, body, seoTitle/Description, isPublished, updatedById).
- `cms_blocks` (key+locale UNIQUE, title, body, updatedById) — small reusable copy snippets.
- `blog_posts` (slug+locale UNIQUE, title, excerpt, body, coverUrl, category, tags[], seo*, isPublished, publishedAt, authorId).
- `faq_items` (locale, category, question, answer, sortOrder, isActive).
- `testimonials` (locale, authorName, authorTitle, body, rating 1–5, avatarUrl, isFeatured, sortOrder).
- `banned_words` (word+locale UNIQUE, severity low/med/high, isActive, createdById).

### Route groups (all under `/api`)
- `routes/adminDashboard.ts` — `GET /admin/dashboard` returns one snapshot (totals, revenue, last-30 audit timeline). 30 s in-memory cache.
- `routes/adminUsersV2.ts` — `GET /admin/users/search` (q, role, status, verified, dateFrom/To, paging), `GET/PATCH/DELETE /admin/users/:id`, `POST /admin/users/:id/reset-password` (returns `tempPassword` once and revokes all refresh tokens), `GET/POST /admin/users/:id/notes`. Self-protect rules: an admin cannot demote/ban/delete themselves.
- `routes/adminPeople.ts` — `GET /admin/freelancers` (filters, sort by createdAt|trustScore), `PATCH /admin/freelancers/:userId/trust-score` (`{set?, delta?}`), `PATCH /admin/freelancers/:userId/visibility` (`{hidden}`); `GET /admin/clients`, `POST /admin/clients/:userId/verify`; `GET /admin/verifications`, `POST /admin/verifications/:id/(approve|reject)`. Verification decisions mirror onto `freelancer_profiles.verificationStatus` / `client_profiles.verificationStatus` based on document `kind`.
- `routes/adminWorkflow.ts` — `GET /admin/jobs/search`, `POST /admin/jobs/:id/(approve|reject|pause|close)`, `POST /admin/jobs/:id/feature` (creates a 30-day `featured_listings` row, since `jobs` has no `is_featured` column), `DELETE /admin/jobs/:id` (soft delete). `GET /admin/proposals`, `PATCH /admin/proposals/:id/visibility`. `GET /admin/contracts/search`, `POST /admin/contracts/:id/(hold|cancel|mark-disputed)`. The original `/admin/users` and `/admin/jobs` endpoints from earlier phases are intentionally untouched — the new search endpoints sit at `/admin/users/search` and `/admin/jobs/search` to avoid clobbering them.
- `routes/adminContent.ts` — admin CRUD `GET/POST/PATCH/DELETE /admin/cms/pages`, upsert `PUT /admin/cms/blocks`, full CRUD for `/admin/blog`, `/admin/faqs`, `/admin/testimonials`. Public read endpoints (no auth): `GET /cms/pages/:slug?locale=`, `GET /cms/blocks/:key?locale=`, `GET /blog?locale=`, `GET /faqs?locale=`, `GET /testimonials?locale=`. Pages are only public when `isPublished=true`; blocks and FAQs gate by `isActive`. Unique-violation handling reads both `e.code` and `e.cause?.code` (drizzle wraps pg errors).
- `routes/adminBroadcast.ts` — `POST /admin/notifications/broadcast` body `{audience: all|freelancers|clients|user_ids, userIds?, kind, title, body, link?}`. Active-only recipients, bulk-inserted in 500-row chunks. Returns `{count, audience}`. Banned-words CRUD at `GET/POST/DELETE /admin/moderation/banned-words`.
- `routes/adminReports.ts` — adds `GET /admin/reports/users-growth?bucket=day|month`, `/admin/reports/revenue-timeseries?bucket=…`, `/admin/reports/top-categories`. All accept `Accept: text/csv` or `?format=csv` to download as CSV with spreadsheet-injection escaping (rows starting with `= + - @ \t \r` are prefixed with `'`). The pre-existing `/admin/reports/revenue`, `/top-freelancers`, `/top-clients` from `routes/reports.ts` (Phase 3) are untouched and continue to serve their original shapes.

### Smoke
- `artifacts/api-server/scripts/smoke-phase6.mjs` — 59 checks covering RBAC denials, dashboard cache stability, user lifecycle (register → search → patch → notes → reset-password → soft-delete), self-protect rules (incl. own-`adminRole` immutability), freelancer trust-score / visibility, client verify, verifications list, job feature/pause/close + soft-delete, proposal hide/unhide, contract hold, CMS pages + blocks (incl. duplicate slug 409), blog/FAQ/testimonial CRUD + public list, broadcast (audience=freelancers and audience=user_ids) + non-admin 403, banned-words CRUD, reports JSON + CSV (with content-type assertion) including legacy endpoints, and the seeded About-Us page + homepage hero block.
- Regression: phases 2 (29) + 3 (37) + 4 (61) + 5 (39) + 6 (59) = **225/225 passing**.

### Phase 6 — known gaps / deferred
- **No admin frontend yet.** Per user instruction, all 22 admin pages are deferred to the follow-up session; this phase ships only the API surface.
- **Notification broadcast is best-effort.** Bulk-inserts notification rows but does not push fan-out via Socket.IO. Connected clients still poll `/notifications` for unread. There is no global cap on `audience='all'` — a runaway broadcast could insert one row per active user; consider a rate limit or admin confirmation prompt before exposing this in the UI.
- **Legacy `routes/admin.ts` endpoints still gate by `requireRole('admin')` only.** Any staff user (regardless of granular `adminRole`) can reach the older endpoints via the legacy admin role. New endpoints in Phase 6 use `requirePermission()` and respect the matrix; migrating the legacy admin.ts surface to the matrix is a follow-up.
- **CSV export currently covers 3 reports.** The legacy `/admin/reports/revenue|top-freelancers|top-clients` endpoints (from Phase 3) still return JSON only — adding CSV there is a future tweak and would require touching `routes/reports.ts`.
- **`featuredListings` rows from `POST /admin/jobs/:id/feature` are not yet read by the public job listing.** The board can audit/track features today; surfacing the boost on the marketplace is a frontend follow-up.
- **OpenAPI/codegen not extended for Phase 6** (same precedent as Phases 2–5). All admin endpoints are hand-fetched from the eventual admin frontend.
