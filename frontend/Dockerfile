# ── Stage 1: Build React app ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is empty by default so nginx proxy handles /api routing
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV GENERATE_SOURCEMAP=false

RUN yarn build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
