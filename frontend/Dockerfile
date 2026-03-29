# ── Stage 1: Build React app ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using yarn (matches project's package manager)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

# Copy source and build
COPY . .

# REACT_APP_BACKEND_URL is empty so nginx proxy handles /api routing internally.
# Set it to an external URL only when deploying frontend/backend on separate domains.
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false

RUN yarn build

# ── Stage 2: Serve with nginx ──────────────────────────────────────────────
FROM nginx:1.27-alpine

# Security: remove default nginx config and run as non-root
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Fix permissions so nginx worker can run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
