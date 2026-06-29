# ── Stage 1: Build React app (npm) ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lockfiles first — Docker layer cache skips npm ci entirely when
# neither package.json nor package-lock.json has changed.
COPY package.json package-lock.json ./

# BuildKit cache mount: keeps the npm HTTP cache between CI runs so
# re-downloading unchanged packages is avoided when deps do change.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is left empty so Caddy proxies /api/* internally.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false \
    DISABLE_ESLINT_PLUGIN=true \
    ESLINT_NO_DEV_ERRORS=true \
    CI=false

RUN npm run build

# ── Stage 2: Serve with Caddy ────────────────────────────────────────────────
FROM caddy:2-alpine

COPY --from=builder /app/build /usr/share/caddy/html
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
