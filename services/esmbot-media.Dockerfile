FROM node:alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apk add --no-cache \
    msttcorefonts-installer freetype fontconfig \
    vips vips-cpp libltdl icu-libs zxing-cpp \
    grep
RUN update-ms-fonts && fc-cache -fv

WORKDIR /app

FROM base AS nt
RUN apk add --no-cache \
    git cmake python3 alpine-sdk \
    fontconfig-dev vips-dev zxing-cpp-dev

FROM nt AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-esmbot,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM nt AS builder
COPY . /app
RUN --mount=type=cache,id=pnpm-esmbot,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm run build:no-magick --CDWITH_BACKWARD=OFF

FROM base AS runner
WORKDIR /app

COPY . /app
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=builder /app/build/Release /app/build/Release
COPY --from=builder /app/dist /app/dist

RUN rm -f .env && rm -rf src natives config

RUN mkdir -p /app/temp /app/logs && chmod 777 /app/temp /app/logs

ENV PORT=3762
EXPOSE 3762

CMD ["node", "dist/api/index.js"]
