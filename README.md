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
