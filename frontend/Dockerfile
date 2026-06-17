# syntax=docker/dockerfile:1.6
# ── Stage 1: Build React app (pnpm) ────────────────────────────────────────────
FROM node:20-alpine AS builder

# Enable corepack and activate pnpm.
# Note: The dev server uses yarn; packageManager field is NOT set in package.json
# to avoid breaking yarn 1.x. This Dockerfile handles pnpm explicitly.
RUN corepack enable && corepack prepare pnpm@9 --activate

# pnpm stores its content-addressable package store at this path. Mounting it
# as a BuildKit cache makes every subsequent build skip the network entirely —
# `pnpm install` finishes in seconds when nothing in pnpm-lock.yaml changed.
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /app

# Install dependencies with a persistent cache mount (BuildKit feature).
# `id=pnpm-store` lets multiple projects on the same builder share the cache.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is left empty so Caddy proxies /api/* internally.
# Override only when frontend and backend are hosted on different origins.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false \
    # CRA 5 / react-scripts 5.0.1 ship eslint-webpack-plugin with options that
    # were REMOVED in ESLint v9 (`extensions`, `resolvePluginsRelativeTo`).
    # Our package.json pins eslint@9.x, so the in-build lint pass crashes with
    # "Unknown options: extensions, resolvePluginsRelativeTo".
    # Lint runs separately in CI; disable the build-time plugin here.
    DISABLE_ESLINT_PLUGIN=true \
    ESLINT_NO_DEV_ERRORS=true \
    CI=false

RUN pnpm run build

# ── Stage 2: Serve with Caddy ────────────────────────────────────────────────
FROM caddy:2-alpine

# Copy built React assets
COPY --from=builder /app/build /usr/share/caddy/html

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
