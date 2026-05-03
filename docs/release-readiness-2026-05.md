# ATMEMLY — Pre-GitHub Release Readiness Report (May 2026)

**Date:** 2026-05-03
**Task:** Final pre-GitHub release check (Task #20)
**Verdict:** ✅ **Safe to push: YES**

This document records the verification pass run on the ATMEMLY monorepo
before the first public push to GitHub. No new product features were
added; the goal was to verify the project, fix safe issues, and prepare
the repo for a clean public push.

---

## 1. Branding sweep

Search for residual "Khidma" / Arabic equivalents across the repo
(excluding `attached_assets/`, `.local/`, `node_modules/`):

```bash
rg -i "khidma|خدمة|خِدمة" --glob '!attached_assets/**' --glob '!.local/**'
```

Result: only **3 lines**, all in `artifacts/mobile/lib/api.ts`:

```
const LEGACY_TOKEN_KEY = "khidma.token";
const LEGACY_USER_KEY  = "khidma.user";
const LEGACY_LANG_KEY  = "khidma.lang";
```

These are **intentional** — kept so existing mobile installs migrate
silently to the new `atmemly.*` AsyncStorage keys without forcing a
re-login. The mobile artifact title, all UI copy, emails, invoices,
seed data, branding singleton (`lib/branding`) and SEO meta all use
ATMEMLY / أتمملي.

Brand source of truth: `lib/branding/src/index.ts`.

## 2. Typecheck

```bash
pnpm run typecheck
```

Result: **PASS** for libs (`tsc --build`) and all 6 leaf workspace
packages (`admin`, `api-server`, `marketplace`, `mobile`,
`mockup-sandbox`, `scripts`). No errors, no broken imports.

## 3. Database, migrations, seed

- Drizzle schema files in `lib/db/src/schema/` are intact (51 tables,
  all foreign keys with explicit `onDelete` per the May audit).
- Generated migration `lib/db/drizzle/0000_atmemly_audit_indexes.sql`
  is committed and matches the schema.
- Seed script `artifacts/api-server/src/seed.ts` references
  `BRAND.supportEmail`, `BRAND.companyName`, etc. (no hardcoded
  Khidma strings). Seed runs successfully against a clean DB.
- A stale `platform_settings` row from a pre-rebrand seed run was
  manually corrected in the dev DB (`support_email`,
  `manual_bank_account_name`). Code already wrote the correct values;
  only the row was stale. Follow-up #21 will make the seed idempotent
  so this can't recur.

## 4. Security audit

- No `sk_live_*`, `pk_live_*`, or `whsec_*` literals in code.
  ```bash
  rg "sk_live|sk_test_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|pk_live" \
     --glob '!attached_assets/**' --glob '!node_modules/**' \
     --glob '!pnpm-lock.yaml' --glob '!.env.example'
  ```
  Only one match: a regex inside `artifacts/api-server/src/lib/env.ts`
  that **validates** the shape of `STRIPE_SECRET_KEY`.
- `.env` is gitignored; `git ls-files | grep .env` returns only
  `.env.example`.
- `.env.example` enumerates every variable consumed by the API server
  with safe placeholders.
- Env validated at boot via Zod (`artifacts/api-server/src/lib/env.ts`)
  — refuses to boot in production with the `dev-secret` placeholder.
- Admin routes wrapped in `requireAuth`; calling `/api/admin/users`
  without a token returns **401**.
- Stripe public key is the only payment string ever sent to the
  marketplace bundle.

## 5. Payments

- Adapters present: **Stripe**, **PayTabs**, **Telr**, **manual**,
  **mock** (registered in seed `payment_gateways`).
- Webhook handler `artifacts/api-server/src/routes/paymentsV2.ts`
  inserts into `payment_webhooks` and is idempotent on
  `(gateway, provider_event_id)` (DB unique constraint + insert with
  `.returning()`).
- Escrow release goes through `releaseToWallet()`
  (`artifacts/api-server/src/lib/escrow.ts`) which checks the
  milestone state machine and the milestone's pending balance — a
  second release call is rejected ("insufficient pending balance").
- Wallet payout endpoint `POST /wallet/payouts` is wrapped in
  `withIdempotency("wallet:payouts")` so client retries with the same
  `Idempotency-Key` are safe (backed by `idempotency_keys` table).
- Invoice templates pull strings from `lib/branding`.

## 6. Admin panel smoke check

`/admin/` returns **200** through the proxy. Layout, dark/light mode
and RTL render correctly (verified on the previous Task #19 visual
refresh, untouched here).

## 7. Marketplace frontend smoke check

`/` returns **200** through the proxy. Arabic RTL is the default
(`dir="rtl"` set on the document root).

## 8. API smoke check

| Endpoint                              | Expected | Got |
| ------------------------------------- | -------- | --- |
| `GET /api/healthz`                    | 200      | 200 |
| `GET /api/settings/public`            | 200 + ATMEMLY values | 200 ✅ |
| `GET /api/admin/users` (no auth)      | 401      | 401 |
| `GET /api/jobs?page=1&limit=2`        | 200 + paginated array | 200 ✅ |
| `POST /api/auth/login` (bad payload)  | 400      | 400 |
| `GET /api/nope`                       | 404      | 404 |

Pagination and Zod validation present on the list/new endpoints
inspected (`jobs.ts`, `proposals.ts`, etc.).

## 9. Repo hygiene

- `.gitignore` excludes `node_modules`, `dist`, `tmp`, `out-tsc`,
  `*.tsbuildinfo`, `.expo`, `.env`, logs, `.DS_Store`, and
  `artifacts/api-server/uploads/`.
- No tracked `.env`, `.log`, `.sqlite`, `.db`, `.tsbuildinfo`, or
  `dist/` files.
- Stray internal prompt artifacts under
  `attached_assets/Pasted-*.txt` removed in this task.
- No stray `console.log` calls in `artifacts/api-server/src/` (seed
  script intentionally retains `console.*` as a one-shot CLI tool).

## 10. README & docs

`README.md` updated with: Getting started commands, per-artifact
script table, environment variables table, default seeded logins,
payments overview, SSO/Keycloak readiness notes, and deployment notes.
The existing May 2026 architecture audit section was preserved.

## 11. Git status

After all changes:

```bash
git status            # clean working tree on main
git ls-files | grep .env   # only .env.example
```

No secrets in the diff. All changes are README + this report + removal
of internal prompt files.

## Issues fixed

1. Stale `platform_settings.support_email` /
   `manual_bank_account_name` updated in the dev DB to the ATMEMLY
   values.
2. README expanded with the missing operational sections.
3. Internal prompt pastes removed from `attached_assets/`.

## Non-blocking follow-ups (proposed)

- **#21** Make the seed script idempotent so brand / settings updates
  propagate to non-empty databases.
- **#22** Block the demo seed from running against production so
  well-known demo passwords can't ship live.

## Commands run

```
rg -i "khidma|خدمة|خِدمة" --glob '!attached_assets/**' --glob '!.local/**'
rg "sk_live|sk_test_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|pk_live" ...
pnpm run typecheck
git status
git ls-files | grep -E '\.env$|\.env\.'
git ls-files | grep -E '(node_modules|/dist/|\.tsbuildinfo$|\.log$)'
curl http://localhost:80/api/healthz
curl http://localhost:80/api/settings/public
curl -o /dev/null -w '%{http_code}' http://localhost:80/api/admin/users
curl 'http://localhost:80/api/jobs?page=1&limit=2'
curl -X POST -d '{"email":"x"}' -H 'Content-Type: application/json' http://localhost:80/api/auth/login
curl -o /dev/null -w '%{http_code}' http://localhost:80/
curl -o /dev/null -w '%{http_code}' http://localhost:80/admin/
```

## Final verdict

**Safe to push to GitHub: YES.**
