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

users, client_profiles, freelancer_profiles, categories, skills, freelancer_skills, jobs, job_skills, proposals, conversations, messages, saved_jobs, payments, reviews, notifications, complaints.

## Auth

- JWT in `Authorization: Bearer <token>` header, injected by `src/lib/custom-fetch.ts` from `localStorage.auth_token`.
- `AuthContext.login(token, user)` persists the token and seeds the user. `useGetMe` rehydrates on reload.
- Role guards in `App.tsx`: `ProtectedClientRoute`, `ProtectedFreelancerRoute`, `ProtectedAdminRoute` redirect to `/login` on mismatch.

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
