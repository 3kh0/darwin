FROM oven/bun:1.3.14-alpine AS base

FROM base AS deps
WORKDIR /workspace

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json

RUN --mount=type=cache,id=bun-web,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --filter @darwin/web

FROM deps AS builder
COPY apps/web ./apps/web
WORKDIR /workspace/apps/web
RUN bun run build

FROM node:alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

COPY --from=builder /workspace/apps/web/.output ./

EXPOSE 3000
CMD ["node", "server/index.mjs"]
