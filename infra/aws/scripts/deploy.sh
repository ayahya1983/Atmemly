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

echo "==> Pulling latest source"
git fetch --all --prune
git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)"

echo "==> Refreshing /opt/atmemly/.env from SSM"
sudo /usr/local/bin/atmemly-fetch-env

# shellcheck disable=SC1090
set -a; . "${ENV_FILE}"; set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL missing from ${ENV_FILE}" >&2
  exit 1
fi

echo "==> Building docker images"
docker compose -f "${COMPOSE_FILE}" build --pull

extract_static () {
  local artifact_path="$1"   # e.g. artifacts/marketplace
  local volume="$2"          # e.g. atmemly_marketplace_static
  local img="atmemly/$(basename "${artifact_path}")-static:latest"

  docker build -f "${artifact_path}/Dockerfile" --target export -t "${img}" .
  docker volume create "${volume}" >/dev/null

  local tmp
  tmp="$(mktemp -d)"
  local cid
  cid="$(docker create "${img}")"
  docker cp "${cid}:/dist/." "${tmp}/"
  docker rm "${cid}" >/dev/null

  docker run --rm \
    -v "${volume}:/dst" \
    -v "${tmp}:/src:ro" \
    alpine:3 sh -c "rm -rf /dst/* /dst/.[!.]* 2>/dev/null; cp -R /src/. /dst/"

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
