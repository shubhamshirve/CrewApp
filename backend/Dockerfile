FROM python:3.11-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache)
# emergentintegrations is a private package not on PyPI; excluded here — AI routes handle the missing import gracefully
COPY requirements.txt .
RUN grep -v "emergentintegrations" requirements.txt > /tmp/requirements_public.txt && \
    pip install --no-cache-dir -r /tmp/requirements_public.txt

# Copy source code
COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
