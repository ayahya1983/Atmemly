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
