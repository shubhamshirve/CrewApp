# syntax=docker/dockerfile:1.6
FROM python:3.11-slim

# Security: run as non-root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# Don't write .pyc files; flush stdout/stderr immediately
# Note: PIP_NO_CACHE_DIR is intentionally NOT set here so the BuildKit
# cache mount below (~/.cache/pip) is used — this makes repeated builds
# of the backend ~10x faster when requirements.txt hasn't changed.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UPLOADS_DIR=/app/uploads

# Install build dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (layer cached separately from source)
COPY requirements.txt .

# 1) Install all public packages (excluding emergentintegrations)
# 2) Attempt to install emergentintegrations from private index — continues
#    even if unavailable (AI routes handle the ImportError gracefully)
#
# The BuildKit cache mount persists ~/.cache/pip across builds on the same host.
# When requirements.txt hasn't changed, pip resolves everything from cache —
# no network downloads needed. This cuts backend rebuild time by ~10x.
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    grep -v "emergentintegrations" requirements.txt > /tmp/requirements_public.txt && \
    pip install -r /tmp/requirements_public.txt && \
    ( pip install emergentintegrations==0.1.0 \
        --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
      || echo "WARNING: emergentintegrations unavailable — AI features disabled" )

# Copy source code
COPY --chown=appuser:appgroup . .

# Create uploads directory with correct ownership BEFORE switching user.
# The non-root user needs write access here at runtime.
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Switch to non-root user
USER appuser

EXPOSE 8001

# Use multiple workers in production; single worker in dev (override via CMD in compose)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
