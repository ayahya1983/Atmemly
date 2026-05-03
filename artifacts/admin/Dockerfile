### --- builder ---
FROM node:20-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /repo
COPY pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json tsconfig.json* ./
COPY artifacts/admin/package.json artifacts/admin/
COPY artifacts/admin/tsconfig.json artifacts/admin/
COPY artifacts/admin/vite.config.ts artifacts/admin/
COPY artifacts/admin/index.html artifacts/admin/
COPY artifacts/admin/components.json artifacts/admin/
COPY lib ./lib

RUN pnpm install --filter @workspace/admin...

COPY artifacts/admin/public artifacts/admin/public
COPY artifacts/admin/src artifacts/admin/src

ARG BASE_PATH=/admin/
ARG PORT=5174
ENV BASE_PATH=${BASE_PATH}
ENV PORT=${PORT}
ENV NODE_ENV=production
RUN pnpm --filter @workspace/admin run build

### --- runtime: tiny static export, served by nginx-proxy ---
FROM scratch AS export
COPY --from=builder /repo/artifacts/admin/dist/public /dist
