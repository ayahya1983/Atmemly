### --- builder ---
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json tsconfig.json* ./
COPY artifacts/marketplace/package.json artifacts/marketplace/
COPY artifacts/marketplace/tsconfig.json artifacts/marketplace/
COPY artifacts/marketplace/vite.config.ts artifacts/marketplace/
COPY artifacts/marketplace/index.html artifacts/marketplace/
COPY artifacts/marketplace/components.json artifacts/marketplace/
COPY lib ./lib

RUN pnpm install --filter @workspace/marketplace...

COPY artifacts/marketplace/public artifacts/marketplace/public
COPY artifacts/marketplace/src artifacts/marketplace/src

ARG BASE_PATH=/
ARG PORT=5173
ENV BASE_PATH=${BASE_PATH}
ENV PORT=${PORT}
ENV NODE_ENV=production
RUN pnpm --filter @workspace/marketplace run build \
 && test -f /repo/artifacts/marketplace/dist/public/index.html \
 && test -d /repo/artifacts/marketplace/dist/public/assets \
 && test -n "$(ls -A /repo/artifacts/marketplace/dist/public/assets)" \
 || (echo "FATAL: marketplace build produced no index.html or empty assets/" >&2 \
     && ls -laR /repo/artifacts/marketplace/dist >&2 || true; exit 1)

### --- runtime: tiny static export, served by nginx-proxy ---
FROM scratch AS export
COPY --from=builder /repo/artifacts/marketplace/dist/public /dist
