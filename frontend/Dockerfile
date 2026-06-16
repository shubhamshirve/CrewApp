# ── Stage 1: Build React app (pnpm) ────────────────────────────────────────────
FROM node:20-alpine AS builder

# Enable corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Install dependencies (frozen lockfile = reproducible builds)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is left empty so Caddy proxies /api/* internally.
# Override only when frontend and backend are hosted on different origins.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false

RUN pnpm run build

# ── Stage 2: Serve with Caddy ────────────────────────────────────────────────
FROM caddy:2-alpine

# Copy built React assets
COPY --from=builder /app/build /usr/share/caddy/html

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
