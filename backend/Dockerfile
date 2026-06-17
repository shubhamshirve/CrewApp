FROM python:3.11-slim

# Security: run as non-root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# PIP_NO_CACHE_DIR is intentionally NOT set — the BuildKit cache mount below
# persists ~/.cache/pip across builds, making pip installs nearly instant when
# requirements.txt hasn't changed.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UPLOADS_DIR=/app/uploads

# Install build dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (layer cached separately from source).
# The BuildKit cache mount keeps ~/.cache/pip warm on the VPS host —
# when requirements.txt hasn't changed, pip resolves everything locally
# with no network downloads at all.
COPY requirements.txt .
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# Copy source code
COPY --chown=appuser:appgroup . .

# Create uploads directory with correct ownership BEFORE switching user
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Switch to non-root user
USER appuser

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
