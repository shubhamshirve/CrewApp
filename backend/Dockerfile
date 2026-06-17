FROM python:3.11-slim

# Security: run as non-root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

# PIP_NO_CACHE_DIR=1 keeps the image lean (no pip http cache inside the image).
# Docker's layer cache handles the real speed-up: this RUN step is skipped
# entirely on deploys where requirements.txt hasn't changed.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UPLOADS_DIR=/app/uploads

# Install build dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (layer cached separately from source).
# Docker re-runs this only when requirements.txt changes — unchanged deploys
# skip it entirely via layer cache.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy source code
COPY --chown=appuser:appgroup . .

# Create uploads directory with correct ownership BEFORE switching user
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Switch to non-root user
USER appuser

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
