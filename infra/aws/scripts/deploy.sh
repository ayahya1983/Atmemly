#!/usr/bin/env bash
# ATMEMLY — production deploy script (run on the EC2 host, or via SSH from your laptop).
#
# What it does:
#   1. git pull the latest commit
#   2. refresh /opt/atmemly/.env from SSM Parameter Store
#   3. build the api-server, marketplace, admin and nginx images
#   4. extract marketplace + admin static bundles into named docker volumes
#   5. push the schema (drizzle-kit) and (optionally) seed
#   6. docker compose up -d
#
# Usage:
#   sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh           # standard deploy
#   SEED=1 sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh    # also run pnpm seed (DESTRUCTIVE)
#
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/atmemly/app}
ENV_FILE=${ENV_FILE:-/opt/atmemly/.env}
SEED=${SEED:-0}

# When ATMEMLY_DOMAIN is set we deploy the TLS stack (Caddy + Let's Encrypt
# in front of nginx). Otherwise we keep the plain-HTTP-on-EIP stack.
#
#   ATMEMLY_DOMAIN=atmemly.com ATMEMLY_ACME_EMAIL=ops@atmemly.com \
#     sudo /opt/atmemly/app/infra/aws/scripts/deploy.sh
#
# Both vars can also live in /opt/atmemly/.env (sourced from SSM below).
if [[ -n "${ATMEMLY_DOMAIN:-}" ]]; then
  COMPOSE_FILE="${APP_DIR}/infra/aws/docker-compose.tls.yml"
  echo "==> TLS mode enabled for domain: ${ATMEMLY_DOMAIN}"
else
  COMPOSE_FILE="${APP_DIR}/infra/aws/docker-compose.prod.yml"
fi

cd "${APP_DIR}"

if [[ "${SKIP_GIT_PULL:-0}" == "1" || "${SKIP_GIT:-0}" == "1" ]]; then
  echo "==> Skipping git pull (SKIP_GIT_PULL/SKIP_GIT=1; source assumed already in place)"
elif [[ -d "${APP_DIR}/.git" ]]; then
  echo "==> Pulling latest source"
  git fetch --all --prune
  git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"
else
  echo "==> ${APP_DIR} is not a git checkout; skipping git pull. Set SKIP_GIT_PULL=1 to silence this."
fi

echo "==> Refreshing /opt/atmemly/.env from SSM"
sudo /usr/local/bin/atmemly-fetch-env

# Sanity-check that DATABASE_URL is present, but do NOT `source` the env
# file — values may contain shell-significant characters (`$`, backticks,
# parentheses, quotes) that would either fail to parse or, worse, execute.
# Containers consume the file via `docker --env-file`, which reads it
# verbatim as KEY=VALUE.
if ! sudo grep -qE '^DATABASE_URL=.+' "${ENV_FILE}"; then
  echo "FATAL: DATABASE_URL missing from ${ENV_FILE}" >&2
  exit 1
fi

# Re-evaluate TLS mode after refreshing the SSM env so the operator can drive
# it entirely from Parameter Store (/atmemly/ATMEMLY_DOMAIN, /atmemly/ATMEMLY_ACME_EMAIL).
# The env file is NOT `source`d (values may contain shell-significant chars),
# so we parse the two TLS knobs out of it with grep and export them into this
# shell. Without this, the GH Actions deploy path (which doesn't pass
# ATMEMLY_DOMAIN via `sudo -E`) silently falls back to the HTTP-only stack
# and tears down Caddy — exactly the regression that took the live site
# offline on May 03, 2026.
if [[ -z "${ATMEMLY_DOMAIN:-}" ]]; then
  ATMEMLY_DOMAIN=$(sudo grep -E '^ATMEMLY_DOMAIN=' "${ENV_FILE}" | head -n1 | cut -d= -f2- || true)
fi
if [[ -z "${ATMEMLY_ACME_EMAIL:-}" ]]; then
  ATMEMLY_ACME_EMAIL=$(sudo grep -E '^ATMEMLY_ACME_EMAIL=' "${ENV_FILE}" | head -n1 | cut -d= -f2- || true)
fi
# Strip any surrounding quotes (defensive — atmemly-fetch-env writes unquoted).
ATMEMLY_DOMAIN="${ATMEMLY_DOMAIN%\"}"; ATMEMLY_DOMAIN="${ATMEMLY_DOMAIN#\"}"
ATMEMLY_ACME_EMAIL="${ATMEMLY_ACME_EMAIL%\"}"; ATMEMLY_ACME_EMAIL="${ATMEMLY_ACME_EMAIL#\"}"

if [[ -n "${ATMEMLY_DOMAIN:-}" && "${COMPOSE_FILE}" != *"docker-compose.tls.yml" ]]; then
  COMPOSE_FILE="${APP_DIR}/infra/aws/docker-compose.tls.yml"
  echo "==> TLS mode enabled (from SSM) for domain: ${ATMEMLY_DOMAIN}"
fi

if [[ "${COMPOSE_FILE}" == *"docker-compose.tls.yml" ]]; then
  if [[ -z "${ATMEMLY_ACME_EMAIL:-}" ]]; then
    echo "FATAL: TLS mode requires ATMEMLY_ACME_EMAIL (Let's Encrypt contact)." >&2
    exit 1
  fi
  if [[ -z "${CORS_ORIGINS:-}" || "${CORS_ORIGINS}" != *"https://${ATMEMLY_DOMAIN}"* ]]; then
    echo "WARNING: CORS_ORIGINS does not include https://${ATMEMLY_DOMAIN}." >&2
    echo "         Update /atmemly/CORS_ORIGINS in SSM to avoid 4xx from the api-server." >&2
  fi
  export ATMEMLY_DOMAIN ATMEMLY_ACME_EMAIL
fi

echo "==> Building docker images"
docker compose -f "${COMPOSE_FILE}" build --pull

extract_static () {
  local artifact_path="$1"   # e.g. artifacts/marketplace
  local volume="$2"          # e.g. atmemly_marketplace_static

  docker volume create "${volume}" >/dev/null

  local tmp
  tmp="$(mktemp -d)"
  # Build the export stage straight onto the host filesystem so we don't
  # need to `docker create` a `FROM scratch` image (which has no command).
  docker buildx build \
    -f "${artifact_path}/Dockerfile" \
    --target export \
    --output "type=local,dest=${tmp}" \
    .

  docker run --rm \
    -v "${volume}:/dst" \
    -v "${tmp}:/src:ro" \
    alpine:3 sh -c "rm -rf /dst/* /dst/.[!.]* 2>/dev/null; cp -R /src/dist/. /dst/"

  rm -rf "${tmp}"
}

echo "==> Extracting marketplace static bundle"
extract_static artifacts/marketplace atmemly_marketplace_static

echo "==> Extracting admin static bundle"
extract_static artifacts/admin atmemly_admin_static

# Shared pnpm content-addressable store on the host. Mounting this into
# the one-off node containers below means successive deploys reuse the
# downloaded package tarballs instead of refetching every dep from the
# registry, which is the slowest part of a no-source-change deploy.
# cloud-init creates this on first boot, but mkdir -p here keeps older
# hosts (provisioned before this change) working too.
PNPM_STORE_DIR=${PNPM_STORE_DIR:-/opt/atmemly/.pnpm-store}
sudo mkdir -p "${PNPM_STORE_DIR}"

echo "==> Pushing database schema (drizzle-kit push)"
# NOTE: --env NODE_ENV=development must come AFTER --env-file so it
# overrides the production value baked into /opt/atmemly/.env. With
# NODE_ENV=production, pnpm skips devDependencies and drizzle-kit
# (a devDep of @workspace/db) is never installed.
docker run --rm \
  --env-file "${ENV_FILE}" \
  --env NODE_ENV=development \
  --env npm_config_frozen_lockfile=false \
  --env npm_config_confirm_modules_purge=false \
  --env npm_config_store_dir=/pnpm-store \
  -v "${APP_DIR}":/repo \
  -v "${PNPM_STORE_DIR}":/pnpm-store \
  -w /repo \
  node:20-bookworm-slim \
  bash -lc "corepack enable && corepack prepare pnpm@9 --activate && pnpm install --prod=false --filter @workspace/db... && pnpm --filter @workspace/db run push"

if [[ "${SEED}" == "1" ]]; then
  echo "==> Seeding database (DESTRUCTIVE — wipes data)"
  docker run --rm \
    --env-file "${ENV_FILE}" \
    --env NODE_ENV=development \
    --env npm_config_frozen_lockfile=false \
    --env npm_config_confirm_modules_purge=false \
    --env npm_config_store_dir=/pnpm-store \
    -v "${APP_DIR}":/repo \
    -v "${PNPM_STORE_DIR}":/pnpm-store \
    -w /repo \
    node:20-bookworm-slim \
    bash -lc "corepack enable && corepack prepare pnpm@9 --activate && pnpm install --prod=false --filter @workspace/api-server... && pnpm --filter @workspace/api-server run seed"
fi

echo "==> Restarting containers"
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "==> Waiting for api-server to become healthy"
# Probe the api-server container directly so the check can't be fooled by
# a frontend (Caddy / nginx) responding 200/308 before the backend is up.
# In TLS mode, plain HTTP on port 80 is a Caddy redirect and would falsely
# pass an `http://localhost/api/healthz` curl; here we exec curl *inside*
# the api-server container against its own port instead.
deploy_ok=0
for _ in {1..45}; do
  if docker compose -f "${COMPOSE_FILE}" exec -T api-server \
       curl -fsS http://localhost:8080/api/healthz >/dev/null 2>&1; then
    deploy_ok=1
    echo "OK (api-server /api/healthz responding)"
    break
  fi
  sleep 2
done

if [[ "${deploy_ok}" != "1" ]]; then
  echo "FATAL: api-server did not become healthy within 90s." >&2
  docker compose -f "${COMPOSE_FILE}" ps >&2 || true
  docker compose -f "${COMPOSE_FILE}" logs --tail=80 api-server >&2 || true
  exit 1
fi

if [[ "${COMPOSE_FILE}" == *"docker-compose.tls.yml" ]]; then
  echo "==> Verifying public HTTPS endpoint"
  # Best-effort: cert may still be issuing on the first ever boot. Don't
  # fail the deploy on this — surface it as a warning so the operator
  # checks `docker compose logs caddy` if it stays red.
  if curl -fsS --max-time 10 "https://${ATMEMLY_DOMAIN}/api/healthz" >/dev/null 2>&1; then
    echo "OK (https://${ATMEMLY_DOMAIN}/api/healthz)"
  else
    echo "WARNING: https://${ATMEMLY_DOMAIN}/api/healthz did not respond." >&2
    echo "         If this is the very first TLS deploy, Caddy may still" >&2
    echo "         be completing the ACME HTTP-01 challenge. Watch:" >&2
    echo "         docker compose -f ${COMPOSE_FILE} logs -f caddy" >&2
  fi
  # Confirm HTTP→HTTPS redirect.
  redirect_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
                    "http://${ATMEMLY_DOMAIN}/" || echo "000")
  if [[ "${redirect_code}" =~ ^30[0-9]$ ]]; then
    echo "OK (http→https redirect: ${redirect_code})"
  else
    echo "WARNING: http://${ATMEMLY_DOMAIN}/ returned ${redirect_code}, expected 30x." >&2
  fi
fi

echo "==> Done. Public URLs:"
if [[ "${COMPOSE_FILE}" == *"docker-compose.tls.yml" ]]; then
  echo "  Marketplace : https://${ATMEMLY_DOMAIN}/"
  echo "  Admin       : https://${ATMEMLY_DOMAIN}/admin/"
  echo "  API health  : https://${ATMEMLY_DOMAIN}/api/healthz"
else
  PUBLIC_IP=$(curl -fsS http://169.254.169.254/latest/meta-data/public-ipv4 || echo "<EC2-IP>")
  echo "  Marketplace : http://${PUBLIC_IP}/"
  echo "  Admin       : http://${PUBLIC_IP}/admin/"
  echo "  API health  : http://${PUBLIC_IP}/api/healthz"
fi
