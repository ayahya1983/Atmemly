# ATMEMLY — UAE Freelance Marketplace

ATMEMLY is a multi-artifact pnpm monorepo containing:

| Artifact            | Path                          | Stack                      |
| ------------------- | ----------------------------- | -------------------------- |
| API server          | `artifacts/api-server`        | Express + Drizzle + Pino   |
| Web marketplace     | `artifacts/marketplace`       | Vite + React + Tailwind    |
| Mobile app          | `artifacts/mobile`            | Expo + React Native        |
| Mockup sandbox      | `artifacts/mockup-sandbox`    | Vite (design previews)     |
| Shared DB schema    | `lib/db`                      | Drizzle ORM (PostgreSQL)   |
| OpenAPI contract    | `lib/api-spec`                | OpenAPI + Orval codegen    |

The API contract is OpenAPI-first: types, Zod schemas and React Query
hooks are generated from `lib/api-spec/openapi.yaml`. The web and mobile
artifacts both consume the generated React Query hooks; the API server
validates inbound requests with the generated Zod schemas.

## Local commands

```bash
pnpm run typecheck             # full project typecheck (libs first, then leaves)
pnpm --filter @workspace/db run push     # push lib/db/src/schema/* to dev Postgres
pnpm --filter @workspace/api-spec run codegen  # regenerate types/zod/hooks
```

Workflows (not `pnpm dev`) start each service. The shared proxy on
`localhost:80` routes `/api/*` to the API server, `/` to the marketplace,
`/mobile` to Expo, and `/mockup` to the mockup sandbox.

## Getting started

```bash
pnpm install                                       # install all workspace deps
pnpm --filter @workspace/api-spec run codegen      # generate types/zod/hooks
pnpm --filter @workspace/db run push               # apply schema to DATABASE_URL
pnpm --filter @workspace/api-server run seed       # one-time seed (dev DB only)
pnpm run typecheck                                 # full project typecheck
```

To run individual artifacts, use the Replit workflows panel rather than
`pnpm dev`. Each workflow wires up the per-artifact `PORT` and any
required env vars.

### Per-artifact scripts

| Workspace package          | Script                                      | Purpose                          |
| -------------------------- | ------------------------------------------- | -------------------------------- |
| `@workspace/api-server`    | `pnpm --filter @workspace/api-server run start` | Start built API (port `$PORT`)   |
| `@workspace/api-server`    | `pnpm --filter @workspace/api-server run seed`  | Seed dev DB with demo data       |
| `@workspace/marketplace`   | (workflow) `vite`                           | Marketplace frontend             |
| `@workspace/admin`         | (workflow) `vite`                           | Admin panel frontend             |
| `@workspace/mobile`        | (workflow) `expo start`                     | Expo dev server                  |
| `@workspace/db`            | `pnpm --filter @workspace/db run push`      | Push Drizzle schema to Postgres  |
| `@workspace/api-spec`      | `pnpm --filter @workspace/api-spec run codegen` | Regenerate types / Zod / hooks   |

## Environment variables

`DATABASE_URL` and `SESSION_SECRET` are managed by Replit and should not be
set manually. Everything else is optional unless the matching gateway /
feature is enabled. See `.env.example` for the canonical list. The API
server validates env on boot via `src/lib/env.ts` (Zod) — invalid or
missing required values fail fast instead of degrading silently.

| Variable                       | Required           | Notes                                                  |
| ------------------------------ | ------------------ | ------------------------------------------------------ |
| `DATABASE_URL`                 | yes (auto)         | Provisioned by Replit                                  |
| `SESSION_SECRET` / `JWT_SECRET`| prod only          | Must be set in production; dev uses safe placeholder   |
| `STRIPE_SECRET_KEY`            | only for Stripe    | Must match `sk_(test|live)_…`                          |
| `STRIPE_WEBHOOK_SECRET`        | only for Stripe    | Must match `whsec_…`                                   |
| `STRIPE_PUBLIC_KEY`            | only for Stripe    | Bundled into the marketplace; never use a secret here  |
| `PAYTABS_PROFILE_ID` / `PAYTABS_SERVER_KEY` / `PAYTABS_REGION` | only for PayTabs | UAE region (`ARE`) by default       |
| `TELR_STORE_ID` / `TELR_AUTH_KEY` / `TELR_TEST_MODE` | only for Telr | `TELR_TEST_MODE=1` by default                |
| `DEFAULT_PAYMENT_GATEWAY`      | no                 | `mock | stripe | paytabs | telr | manual`              |
| `PLATFORM_CURRENCY` / `PLATFORM_FEE_PERCENTAGE` | no | Defaults: `AED`, `10`                                  |
| `MANUAL_BANK_*`                | no                 | Shown to clients on the manual transfer flow           |
| `CORS_ORIGINS`                 | recommended (prod) | Comma-separated allow-list; unset = open in dev only   |
| `LOG_LEVEL`                    | no                 | `fatal|error|warn|info|debug|trace`                    |

## Default seeded logins (dev only)

The seed script creates demo accounts for local development. **Rotate or
delete these in any non-development environment.**

| Role        | Email                  | Password         |
| ----------- | ---------------------- | ---------------- |
| Super admin | `admin@atmemly.com`    | `admin1234`      |
| Client      | e.g. `layla@atmemly.com` | `client1234`   |
| Freelancer  | e.g. `noor@atmemly.com`  | `freelancer1234` |

The seed script refuses to run when `NODE_ENV=production` so these
publicly documented passwords cannot be shipped live by accident. If you
deliberately need to seed a production database (e.g. a staging clone
that happens to be tagged production), re-run with an explicit
`ALLOW_PROD_SEED=1` env var:

```bash
ALLOW_PROD_SEED=1 pnpm --filter @workspace/api-server run seed
```

Always rotate or delete the demo accounts immediately afterwards.

## Payments

Stripe, PayTabs, Telr, and a manual bank-transfer adapter are all
implemented. All payment status mutations happen on the backend; the
frontend never marks a payment as paid. Webhook handlers persist every
event in `payment_webhooks` and are idempotent on `(gateway, provider_event_id)`.
Escrow release goes through `releaseToWallet()` which checks the milestone
state machine and the milestone's pending balance before crediting the
wallet, so a double release is rejected. The wallet payout endpoint
additionally supports the `Idempotency-Key` header (`withIdempotency`
middleware backed by the `idempotency_keys` table) to make client retries
safe.

Set `DEFAULT_PAYMENT_GATEWAY=mock` for local smoke tests; set it to
`stripe`, `paytabs`, `telr`, or `manual` and provide the matching
credentials to enable a real provider. All invoice templates use the
ATMEMLY brand strings from `lib/branding`.

## SSO / Keycloak readiness

The platform auth is JWT + refresh-token based today. Enterprise SSO
(Google, LinkedIn, Microsoft, OIDC, Keycloak) is being layered in via a
separate set of tasks (#8, #16, #17, #18). The DB groundwork (provider
table, identity-link table) is owned by those tasks. Provider client
secrets are intended to be stored server-side and masked in admin
responses; never expose SSO secrets in the marketplace bundle.

## Deployment notes

* The repo is a pnpm workspace. Always install with `pnpm install` and
  never commit `package-lock.json` / `yarn.lock` (the root preinstall
  hook deletes them).
* Production must set `SESSION_SECRET` (or `JWT_SECRET`) and a real
  `CORS_ORIGINS` allow-list. The env validator refuses to boot with the
  `dev-secret` placeholder in production.
* Run `pnpm --filter @workspace/db run push` (or generated migrations
  in `lib/db/drizzle/`) against the production database before the
  first boot.
* Do **not** run the seed script against production — it inserts demo
  users with publicly known passwords. The seed script enforces this at
  runtime: it throws when `NODE_ENV=production` unless you explicitly
  set `ALLOW_PROD_SEED=1` (see "Default seeded logins" above).
* `artifacts/api-server/uploads/` is the local file store. For
  production, swap the `LocalFileStore` in `src/lib/storage.ts` for an
  S3 / GCS / Replit Object Storage implementation of the same `FileStore`
  interface.
* `helmet` is mounted on the API server. The marketplace ships its own
  CSP. CORP is `cross-origin` so `/api/uploads/*` stays embeddable from
  the marketplace origin.

## Architecture audit (May 2026)

The May 2026 audit added a set of safe, non-breaking hardening passes
across the database, backend and frontend. None of the public API
contracts changed; only response timing/headers and a few new optional
columns / opt-in features moved. A second, ATMEMLY-branded enterprise
audit pass (also May 2026) layered additional hardening on top — see
`docs/ATMEMLY-architecture-audit.md` for the full report covering
financial integrity guards, idempotency, structured logging with
request IDs, env validation, admin pagination/filter/CSV coverage,
and the N+1 fix in `/admin/clients`.

### Database (`lib/db`)

* **Foreign-key references.** Every cross-table integer column that is
  semantically a foreign key now declares `.references(() => …)` with an
  explicit `onDelete` policy:
  * `cascade` — child rows die with the parent (e.g. `proposals → jobs`,
    `milestones → contracts`, `notifications → users`,
    `wallet_transactions → wallets`, FK profile tables → users).
  * `restrict` — block parent deletion when business records exist
    (e.g. `payments`, `contracts`, `invoices`, `payouts`,
    `messages.sender_id`).
  * `set null` — keep the historical row when the optional reference is
    deleted (e.g. `payments.contract_id`/`milestone_id`,
    `escrow_events.*`, `audit_logs.user_id`, `payouts.processed_by`,
    `invoices.contract_id`/`milestone_id`/`payment_id`).
  * `milestones.payment_id` is intentionally NOT a hard FK — adding it
    would create a cycle with `payments.milestone_id`. The integrity is
    enforced by the `payments → milestones` FK in the other direction.
* **`updated_at` timestamps** added to `users`, `jobs`, `proposals`,
  `freelancer_profiles`, `client_profiles`, `reviews`, `notifications`
  (defaulted to `now()`). Existing tables that already had it
  (contracts, disputes, wallets, payment_intents, payment_gateways)
  were left as-is.
* **`deleted_at` soft-delete** columns added to `users`, `jobs`,
  `proposals`, `messages`, `attachments`, `reviews`. These columns are
  nullable; existing list/get queries continue to return all rows
  unchanged. Routes that need soft-delete semantics can opt in by
  filtering `isNull(table.deletedAt)`.
* **Indexes** added for the heaviest admin/list paths:
  * `payments(job_id)`, `payments(payer_id)`, `payments(payee_id)`,
    `payments(status, created_at)` composite for admin payment lists.
  * `users(status)` and `users(deleted_at)` for admin user filters.
  * `reviews(from_user_id)` and `reviews(to_user_id)` for profile
    aggregation queries.
  * `payouts(status, requested_at)` composite for the batch builder.
  * `jobs(deleted_at)`, `proposals(deleted_at)`, `messages(deleted_at)`,
    `attachments(deleted_at)` for soft-delete filtering.
  * `audit_logs(action)` for admin filter dropdowns.
* **`idempotency_keys` table** (NEW) — `(route, key)` UNIQUE, stores the
  request hash, response status and JSON snapshot. Backs the new
  `withIdempotency()` middleware.

### Backend (`artifacts/api-server`)

* **`helmet`** mounted at the top of the middleware chain. CSP and COEP
  are disabled because the API only serves JSON / file streams; the
  marketplace front end applies its own CSP. CORP is set to
  `cross-origin` so `/api/uploads/*` stays embeddable from the
  marketplace origin. The legacy `securityHeaders()` middleware remains
  as a defense-in-depth fallback.
* **`withIdempotency(routeKey)` middleware** (`src/lib/idempotency.ts`)
  — opt-in replay protection driven by the `Idempotency-Key` request
  header. Mounted on `POST /wallet/payouts`. Sending the same key with
  the same body returns the original 2xx response verbatim with
  `X-Idempotent-Replay: true`; sending it with a different body returns
  409. Storage failures degrade gracefully — the route still completes,
  because the underlying `payment_transactions` table also enforces
  `(gateway, idempotency_key)` UNIQUE for race safety.
* **`FileStore` interface** (`src/lib/storage.ts`) — abstraction with a
  `LocalFileStore` implementation that wraps the existing local
  `uploads/` directory. Future deployments can swap to S3 / GCS /
  Replit Object Storage by implementing the same four methods
  (`put`, `read`, `has`, `remove`) without touching routes.
* **Logger discipline.** All `console.*` calls in non-script code were
  replaced with the singleton Pino `logger` (or `req.log` when a
  request is in scope). The seed CLI script keeps `console.*` because
  it is a one-shot tool invoked outside the request lifecycle.

### Frontend (`artifacts/marketplace`)

* **`ErrorBoundary` component** (`src/components/ErrorBoundary.tsx`) —
  catches uncaught render errors that would otherwise blank the screen,
  shows a recovery UI with a Reload button, and logs the error and
  component stack to the browser console. Mounted in two places in
  `App.tsx`:
  * `scope="App"` around the entire router so a public-page crash
    still renders the recovery UI.
  * `scope="Admin"` inside `ProtectedAdminRoute` so an admin-only
    crash never tanks the public marketplace.

### Operational notes

* The schema push that introduced the new FKs required cleaning a
  handful of orphan rows in `saved_search_alerts`, `contracts` and
  `milestones`. Production migrations should run an equivalent cleanup
  pre-flight (or use `set null` instead of `restrict` if cleanup is
  not feasible). See `lib/db/src/schema/*.ts` for the canonical list of
  references and their `onDelete` policy.
* No public API response shape was changed by this audit. New columns
  (`updated_at`, `deleted_at`) are not surfaced in any existing
  response Zod schema; consumers continue to see the same fields.
