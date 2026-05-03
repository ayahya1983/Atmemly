### --- builder ---
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

WORKDIR /repo

# Copy workspace manifests for cache-friendly install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json* ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/api-server/build.mjs artifacts/api-server/
COPY artifacts/api-server/tsconfig.json artifacts/api-server/
COPY lib ./lib

RUN pnpm install --filter @workspace/api-server... --frozen-lockfile

# Copy source and build
COPY artifacts/api-server/src artifacts/api-server/src
COPY artifacts/api-server/scripts artifacts/api-server/scripts
RUN pnpm --filter @workspace/api-server run build

# Produce a self-contained, prod-only deploy tree at /deploy. `pnpm deploy`
# resolves all workspace symlinks (including the .pnpm tree under the
# workspace root) into a flat node_modules so the runtime stage can copy
# a single directory without leaving dangling symlinks. This replaces the
# previous "COPY artifact node_modules" approach which silently relied on
# pnpm 9's node_modules layout — pnpm 10 isolates deps via .pnpm/, so the
# artifact-local node_modules contained only symlinks back into /repo.
RUN pnpm --filter @workspace/api-server deploy --prod --legacy /deploy

### --- runtime ---
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 atmemly

COPY --from=builder /repo/artifacts/api-server/dist ./dist
COPY --from=builder /deploy/package.json ./package.json
COPY --from=builder /deploy/node_modules ./node_modules

USER atmemly
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS http://localhost:8080/api/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
