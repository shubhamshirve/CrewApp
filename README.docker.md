# Photoo — Docker Setup Guide

## Prerequisites
- Docker 24+
- Docker Compose v2

---

## Quick Start

```bash
# 1. Clone the repo
git clone <your-repo-url> photoo
cd photoo

# 2. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your real values:
#   - JWT_SECRET (strong random string)
#   - RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
#   - EMERGENT_LLM_KEY

# 3. Build and start all services
docker compose up --build

# 4. Seed the admin account (first-run only)
curl -X POST http://localhost/api/admin/seed-admin
```

Open **http://localhost** in your browser.  
Admin login: `admin@photoo.in` / `Admin@123`

---

## Services

| Service   | Container            | Internal Port | Exposed |
|-----------|----------------------|---------------|---------|
| Frontend  | photoo-frontend    | 80            | 80      |
| Backend   | photoo-backend     | 8001          | 8001    |
| MongoDB   | photoo-mongodb     | 27017         | —       |

> MongoDB is **not** exposed externally by default. Add `ports: ["27017:27017"]` under the `mongodb` service if you need direct access.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable               | Description                              | Default           |
|------------------------|------------------------------------------|-------------------|
| `MONGO_URL`            | MongoDB connection string                | `mongodb://localhost:27017` |
| `DB_NAME`              | Database name                            | `photoo_db`     |
| `CORS_ORIGINS`         | Allowed origins (comma-separated)        | `*`               |
| `JWT_SECRET`           | Secret for JWT signing (**change this**) | —                 |
| `RAZORPAY_KEY_ID`      | Razorpay API key ID                      | —                 |
| `RAZORPAY_KEY_SECRET`  | Razorpay API key secret                  | —                 |
| `EMERGENT_LLM_KEY`     | Emergent LLM key for Gemini Flash        | —                 |
| `REFERRAL_REWARD_AMOUNT` | INR reward per successful referral     | `50`              |

> When using `docker-compose.yml`, `MONGO_URL` is **automatically overridden** to `mongodb://mongodb:27017` so you don't need to change it manually.

### Frontend (`frontend/.env.example`)

| Variable                  | Description                                                 |
|---------------------------|-------------------------------------------------------------|
| `REACT_APP_BACKEND_URL`   | Leave **empty** in docker-compose (nginx handles `/api` proxy). Set to full URL for separate deployments. |

---

## Common Commands

```bash
# Start in background
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Stop and remove volumes (wipes MongoDB data)
docker compose down -v

# Rebuild a single service
docker compose build backend
docker compose up -d --no-deps backend

# Open a shell in the backend container
docker compose exec backend bash

# Run backend tests inside container
docker compose exec backend pytest tests/
```

---

## Architecture

```
Browser
  │
  ▼
┌─────────────────────────────────┐
│ nginx (frontend:80)             │
│  /api  → proxy → backend:8001  │
│  /*    → React SPA (index.html) │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ FastAPI (backend:8001)          │
│  Razorpay · Gemini Flash AI     │
│  WhatsApp (mocked)              │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ MongoDB 7.0 (mongodb:27017)     │
│  Persisted volume: photoo_    │
│  mongodb_data                   │
└─────────────────────────────────┘
```

---

## Deploying to Production

### Environment Hardening

1. Set a strong `JWT_SECRET` (32+ random characters)
2. Restrict `CORS_ORIGINS` to your frontend domain
3. Use Razorpay **live** keys (replace `rzp_test_` with `rzp_live_`)
4. Add TLS — use a reverse proxy like Traefik or Caddy in front of the frontend container

### Sample production compose override (`docker-compose.prod.yml`)

```yaml
services:
  frontend:
    build:
      args:
        REACT_APP_BACKEND_URL: ""   # keep empty; nginx proxies /api
    environment:
      - NODE_ENV=production

  backend:
    environment:
      - CORS_ORIGINS=https://yourdomain.com
```

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot connect to MongoDB` | Wait for the healthcheck — backend waits for MongoDB |
| `API returns 502 Bad Gateway` | Backend may still be starting; check `docker compose logs backend` |
| `WhatsApp notifications not sending` | WhatsApp is **mocked** — messages are logged to the `whatsapp_logs` collection |
| `Razorpay payment failing` | Ensure you're using matching Key ID + Secret; check test vs live mode |
