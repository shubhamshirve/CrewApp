# CrewBook

> Freelance crew booking platform for the Indian film & events industry.
> Photographers, videographers, and assistants discover gigs, build teams, and manage bookings — all in one place.

[![CI — GHCR](https://github.com/shubhamshirve/CrewApp/actions/workflows/ci.yml/badge.svg)](https://github.com/shubhamshirve/CrewApp/actions/workflows/ci.yml)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start (Docker)](#quick-start-docker)
- [Scripts](#scripts)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [CI/CD — GHCR](#cicd--ghcr)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Changelog](#changelog)

---

## Features

### For Photographers & Crew

| Feature | Description |
|---------|-------------|
| **Profile & Gear Vault** | Roles, day rates, equipment list (cameras, lenses, drones), social links, UPI Pay ID |
| **ID Verification** | Upload Aadhaar / PAN / DL + selfie; admin-verified badge |
| **Gig Management** | Create gigs with multiple sessions, invite crew, negotiate fees |
| **90-min Buffer Rule** | Backend enforces a 90-minute gap between back-to-back bookings |
| **Gig Board** | Browse & apply for public gigs with match-score algorithm |
| **Ratings** | Private, granular ratings (Punctuality, Gear Handling, Teamwork) after each booking — visible on public profile |
| **Wallet** | Razorpay subscriptions (Basic ₹69 / Pro ₹99), referral rewards, payment ledger |
| **In-app Chat** | Per-gig team chat with unread badge & push notifications |
| **Calendar** | Month view with gig markers; standby mode toggle |
| **AI Suggestions** | Gemini Flash: crew recommendations & gig checklists |
| **PWA** | Installable on Android / iOS; works offline; push notifications |

### Admin Panel (`/admin/*`)

| Feature | Description |
|---------|-------------|
| **Dashboard** | Platform stats: users, revenue, active gigs |
| **Verification Queue** | Approve / reject ID documents with reason |
| **User Management** | Search, filter, bulk actions, deep-dive profiles, wallet adjustments, feature/risk flags |
| **Penalty System** | 1–5 star penalty scale; auto-suspend at 5 stars |
| **Gig Board** | Admin view of all public gigs |
| **Plans** | Full CRUD for subscription plans with feature flags |
| **Coupons** | Create, toggle, delete discount coupons (% or fixed ₹) |
| **Settings** | Platform pricing, event types, role categories, gear catalogue |
| **Reports** | Revenue & registration charts (7/14/30-day ranges) |
| **Logs & Monitoring** | 6 live log tabs: Activity · API Errors · Payments · AI Usage · WhatsApp · Login Audit |
| **Notification Templates** | Manage in-app / WhatsApp / email message templates |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Tailwind CSS v3, Radix UI, Lucide icons |
| Package manager | **pnpm 9** |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB driver) |
| Database | **MongoDB 4.4** |
| Reverse proxy | **Caddy 2** (gzip, security headers, SPA fallback, API proxy) |
| Payments | Razorpay (UPI + cards, Indian market) |
| AI | Google Gemini Flash via Emergent Universal Key |
| Notifications | In-app · WhatsApp (mocked) · Web Push |
| Containerization | Docker Compose |
| CI/CD | GitHub Actions → **GHCR** |

---

## Quick Start (Docker)

### Prerequisites
- Docker 24+ and Docker Compose v2
- A server with ≥ 1 GB RAM (tuned for 1 GB VPS)

```bash
# 1. Clone the repository
git clone https://github.com/shubhamshirve/CrewApp.git crewbook
cd crewbook

# 2. Configure the backend environment
cp backend/.env.example backend/.env
# Open backend/.env and set:
#   JWT_SECRET  — generate: python3 -c "import secrets; print(secrets.token_hex(32))"
#   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET  (use test keys for dev)
#   EMERGENT_LLM_KEY  (for AI features)

# 3. Build and start all services
docker compose up --build -d

# 4. Seed sample data (creates admin + demo users/gigs)
docker compose exec backend python /app/scripts/seed_data.py

# 5. Open the app
open http://localhost
```

**Default credentials after seeding:**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@crewbook.in` | `Admin@123` |
| Lead Photographer | `rohan@example.com` | `Test@1234` |
| Second Shooter | `priya@example.com` | `Test@1234` |
| Videographer | `aakash@example.com` | `Test@1234` |
| Drone Operator | `kavya@example.com` | `Test@1234` |
| Photo Assistant | `vikram@example.com` | `Test@1234` |

---

## Scripts

All scripts live in `scripts/` and use the same `MONGO_URL` / `DB_NAME` environment variables as the backend.

### Seed sample data

```bash
# Run directly (local)
cd scripts
MONGO_URL=mongodb://localhost:27017 DB_NAME=crewbook_db python seed_data.py

# Run inside Docker
docker compose exec backend python /app/scripts/seed_data.py
```

What it creates:
- 1 admin account + 5 crew users (all roles)
- 2 subscription plans (Basic ₹69 · Pro ₹99)
- 1 completed gig with accepted invites, ratings, and chat messages
- 1 active gig with pending invite
- 1 public gig listing open for applications
- 2 active connections (accepted)
- 2 discount coupons (`WELCOME20`, `CREW50`)

### Reset the database

```bash
# Wipe all data — prompts for confirmation
MONGO_URL=mongodb://localhost:27017 DB_NAME=crewbook_db python scripts/reset_db.py

# Skip confirmation prompt
python scripts/reset_db.py --yes

# Wipe and immediately re-seed demo data
python scripts/reset_db.py --yes --seed

# Docker
docker compose exec backend python /app/scripts/reset_db.py --yes --seed
```

> ⚠️ `reset_db.py` **permanently deletes all data** in every collection. Use with care.

---

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and edit env
cp .env.example .env

# Start with hot-reload
uvicorn server:app --reload --port 8001
```

API docs (dev only): http://localhost:8001/api/docs

### Frontend

```bash
cd frontend
pnpm install
pnpm start        # http://localhost:3000
```

> The frontend proxies `/api/*` to `http://localhost:8001` via CRACO in dev.

### Running backend tests

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 pytest tests/ -v
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URL` | ✅ | — | MongoDB connection string |
| `DB_NAME` | ✅ | — | Database name (`crewbook_db`) |
| `JWT_SECRET` | ✅ | — | 32+ char secret for JWT signing |
| `ENV` | | `development` | `production` hides API docs, enforces stricter settings |
| `CORS_ORIGINS` | | `*` | Comma-separated allowed origins — **restrict in production** |
| `ADMIN_SEED_SECRET` | | *(disabled)* | Set to enable `POST /api/admin/seed-admin` (pass as `X-Seed-Secret` header) |
| `ADMIN_DEFAULT_PASSWORD` | | `Admin@123` | Password used when seed-admin creates the account |
| `RAZORPAY_KEY_ID` | | — | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | | — | Razorpay API key secret |
| `EMERGENT_LLM_KEY` | | — | Emergent Universal Key for Gemini Flash AI |
| `VAPID_PUBLIC_KEY` | | — | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | | — | Web Push VAPID private key |
| `VAPID_CONTACT_EMAIL` | | `admin@crewbook.in` | Web Push contact email |
| `RESEND_API_KEY` | | *(mocked)* | Resend email API key — email is mocked when not set |
| `UPLOADS_DIR` | | `/app/uploads` | Directory for profile picture uploads |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend base URL. **Leave empty** in Docker — Caddy proxies `/api/*` internally. |

---

## CI/CD — GHCR

Every push to `main` or `develop` triggers `.github/workflows/ci.yml` which:

1. **Builds** backend and frontend Docker images in parallel
2. **Pushes** to GitHub Container Registry:
   - `ghcr.io/shubhamshirve/crewapp-backend`
   - `ghcr.io/shubhamshirve/crewapp-frontend`
3. **Tags** each image with:
   - `latest` (main branch only)
   - `sha-<short-commit>` (all branches)
   - branch name

Pull requests build images but **do not push** (validation only).

### Deploy from GHCR on your VPS

```bash
# Pull latest images
docker pull ghcr.io/shubhamshirve/crewapp-backend:latest
docker pull ghcr.io/shubhamshirve/crewapp-frontend:latest

# Or use in docker-compose by replacing `build:` with `image:`
```

For private packages, authenticate first:

```bash
echo $GITHUB_PAT | docker login ghcr.io -u shubhamshirve --password-stdin
```

---

## Architecture

```
Browser / PWA
      │
      ▼
┌─────────────────────────────────────────┐
│  Caddy (frontend:80)                    │
│   /api/*  ──proxy──►  backend:8001      │
│   /*       ──SPA──►   React (index.html)│
│  gzip · security headers · TLS ready   │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  FastAPI (backend:8001)                 │
│   Auth · Gigs · Wallet · Ratings        │
│   Razorpay · Gemini Flash · Web Push   │
│   Rate limiting · Security headers      │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  MongoDB 4.4 (mongodb:27017)            │
│   Persisted volume: crewbook_mongodb_   │
│   data (256 MB limit, 1 GB VPS)        │
└─────────────────────────────────────────┘
```

---

## Project Structure

```
CrewApp/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD — Build & Push to GHCR
├── backend/
│   ├── routers/                # One file per domain
│   │   ├── admin.py            # Admin panel, penalties, logs
│   │   ├── auth.py             # Register, login, OTP, password reset
│   │   ├── gigs.py             # Gig CRUD, invites, 90-min buffer, chat
│   │   ├── ratings.py          # Submit & view ratings (membership-validated)
│   │   ├── wallet.py           # Balance, Razorpay subscriptions
│   │   ├── users.py            # Profiles, gear vault, ID upload
│   │   ├── public_gigs.py      # Public gig board
│   │   ├── coupons.py          # Coupon CRUD + validation
│   │   ├── plans.py            # Subscription plan management
│   │   ├── uploads.py          # Profile picture upload
│   │   └── ...                 # notifications, connections, ai, etc.
│   ├── services/
│   │   ├── notifications_service.py
│   │   ├── whatsapp_mock.py
│   │   ├── email_service.py    # Resend (mocked if no API key)
│   │   └── pdf_service.py      # Contract PDF generation
│   ├── tests/
│   ├── server.py               # App entrypoint, middleware, startup indexes
│   ├── db.py                   # Motor async client
│   ├── auth_utils.py           # JWT, bcrypt helpers
│   ├── cache.py                # Async TTL cache (5-min)
│   ├── rate_limit.py           # slowapi configuration
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/              # User-facing pages
│   │   ├── pages/admin/        # Admin panel sub-pages
│   │   ├── components/         # Layout, PlanGate, InstallAppButton, etc.
│   │   └── contexts/           # AuthContext, PlatformContext
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   ├── sw.js               # Service Worker v3 (cache-first + offline)
│   │   └── offline.html        # Offline fallback page
│   ├── Dockerfile
│   ├── Caddyfile
│   ├── package.json            # packageManager: pnpm@9
│   └── pnpm-lock.yaml
├── scripts/
│   ├── seed_data.py            # Insert realistic sample data
│   └── reset_db.py             # Wipe all data (+ optional re-seed)
├── docker-compose.yml
├── README.md
├── README.docker.md
└── CHANGELOG.md
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

## License

MIT © Shubham Shirve
