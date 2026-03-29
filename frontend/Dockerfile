# ── Stage 1: Build React app ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (npm ci uses package-lock.json for reproducible builds)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is empty so Caddy proxy handles /api routing internally.
# Set it to an external URL only when deploying frontend/backend on separate domains.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false

RUN npm run build

# ── Stage 2: Serve with Caddy ────────────────────────────────────────────────
FROM caddy:2-alpine

# Copy built React assets
COPY --from=builder /app/build /usr/share/caddy/html

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
