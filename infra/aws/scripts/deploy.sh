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
COMPOSE_FILE="${APP_DIR}/infra/aws/docker-compose.prod.yml"
SEED=${SEED:-0}

cd "${APP_DIR}"

if [[ "${SKIP_GIT:-0}" == "1" || ! -d .git ]]; then
  echo "==> Skipping git pull (SKIP_GIT=1 or no .git directory)"
else
  echo "==> Pulling latest source"
  git fetch --all --prune
  git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"
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

echo "==> Pushing database schema (drizzle-kit push)"
docker run --rm \
  --env-file "${ENV_FILE}" \
  -v "${APP_DIR}":/repo \
  -w /repo \
  node:20-bookworm-slim \
  bash -lc "corepack enable && corepack prepare pnpm@9 --activate && pnpm install --filter @workspace/db... && pnpm --filter @workspace/db run push"

if [[ "${SEED}" == "1" ]]; then
  echo "==> Seeding database (DESTRUCTIVE — wipes data)"
  docker run --rm \
    --env-file "${ENV_FILE}" \
    -v "${APP_DIR}":/repo \
    -w /repo \
    node:20-bookworm-slim \
    bash -lc "corepack enable && corepack prepare pnpm@9 --activate && pnpm install --filter @workspace/api-server... && pnpm --filter @workspace/api-server run seed"
fi

echo "==> Restarting containers"
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "==> Waiting for api-server to become healthy"
for _ in {1..30}; do
  if curl -fsS http://localhost/api/healthz >/dev/null 2>&1; then
    echo "OK"
    break
  fi
  sleep 2
done

echo "==> Done. Public URLs:"
PUBLIC_IP=$(curl -fsS http://169.254.169.254/latest/meta-data/public-ipv4 || echo "<EC2-IP>")
echo "  Marketplace : http://${PUBLIC_IP}/"
echo "  Admin       : http://${PUBLIC_IP}/admin/"
echo "  API health  : http://${PUBLIC_IP}/api/healthz"
