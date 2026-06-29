# ── Stage 1: Build — install deps with compiler tools ───────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
    && rm -rf /var/lib/apt/lists/*

# Create an isolated venv so Stage 2 only needs to copy /venv — no gcc needed.
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY requirements.txt .

# BuildKit cache mount: pip HTTP cache survives between CI builds.
# Layer cache: this step is skipped entirely when requirements.txt hasn't changed.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ── Stage 2: Runtime — slim image, no build tools ────────────────────────────
FROM python:3.11-slim

RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh --create-home appuser

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/venv/bin:$PATH" \
    UPLOADS_DIR=/app/uploads

# Only the compiled packages — gcc and build-essential stay in Stage 1.
COPY --from=builder /venv /venv

COPY --chown=appuser:appgroup . .

RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

USER appuser

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", \
     "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
