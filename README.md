# CrewBook

A freelance crew booking platform for the Indian film and events industry. Crew members discover gigs, connect with clients, and manage their bookings — all in one place.

---

## Features

### User App
- **Registration & Profiles** — onboarding flow with location, skills, and portfolio
- **Gig Board** — browse and apply for film/event crew gigs
- **Connections** — follow and connect with other crew members
- **Wallet & Subscriptions** — Razorpay-powered base/premium plans; admin wallet adjustments
- **AI Tools** — Gemini Flash crew suggestions and gig checklists
- **Notifications** — in-app and WhatsApp (simulated) alerts
- **Calendar** — view upcoming gig schedule

### Admin Panel (`/admin/*`)
- **Overview** — platform stats at a glance
- **Verification Queue** — approve/reject crew verification requests
- **User Management** — search, filter, bulk actions (verify/suspend/notify), deep-dive profile, wallet adjustments, feature/risk flags
- **Impersonation** — admin can open a session as any user for support
- **Penalties** — issue and track penalties against users
- **Gig Board** — admin view of all gigs
- **Logs & Monitoring** — six live log tabs:
  - Activity — every admin mutation with before/after
  - API Errors — all 4xx/5xx with path, user, and stack trace
  - Payments — full Razorpay lifecycle (order → verify/fail)
  - AI Usage — Gemini calls with char counts and INR cost estimate
  - WhatsApp — simulated delivery log
  - Login Audit — all logins with IP and user agent
- **Settings** — platform-level configuration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS, Radix UI, lucide-react |
| Backend | Python 3.11, FastAPI, Motor (async MongoDB) |
| Database | MongoDB 7.0 |
| Payments | Razorpay |
| AI | Google Gemini Flash (`gemini-2.5-flash`) |
| Notifications | WhatsApp (mocked; real receipts planned) |
| Infra | Docker Compose, nginx reverse proxy |

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/shubhamshirve/CrewApp.git crewbook
cd crewbook

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, EMERGENT_LLM_KEY

# 3. Start all services
docker compose up --build

# 4. Seed the admin account (first run only)
curl -X POST http://localhost/api/admin/seed-admin
```

Open **http://localhost** in your browser.

**Admin login:** `admin@crewbook.in` / `Admin@123`

For full Docker documentation see [README.docker.md](README.docker.md).

---

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm start          # http://localhost:3000
```

---

## Running Tests

Integration tests make real HTTP calls against a live backend. Start the backend first, then:

```bash
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 pytest tests/test_crewbook.py -v
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string (default: `mongodb://localhost:27017`) |
| `DB_NAME` | Database name (default: `crewbook_db`) |
| `JWT_SECRET` | Secret for JWT signing — **must be set in production** |
| `CORS_ORIGINS` | Allowed origins, comma-separated (default: `*`) |
| `RAZORPAY_KEY_ID` | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `EMERGENT_LLM_KEY` | API key for Gemini Flash |
| `REFERRAL_REWARD_AMOUNT` | INR credit per referral (default: `50`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend URL. Leave empty when using Docker (nginx proxies `/api`). |

---

## Project Structure

```
CrewBook/
├── backend/
│   ├── routers/          # One file per domain (admin, auth, wallet, …)
│   ├── services/         # log_service.py, whatsapp_mock.py
│   ├── db.py             # Motor client
│   ├── auth_utils.py     # JWT helpers
│   ├── server.py         # App, exception handlers, startup
│   └── tests/
│       └── test_crewbook.py
├── frontend/
│   └── src/
│       ├── pages/admin/  # Admin panel pages
│       ├── pages/        # User-facing pages
│       ├── components/   # Shared components (AdminLayout, etc.)
│       └── contexts/     # AuthContext
├── docs/superpowers/
│   ├── specs/            # Design documents
│   └── plans/            # Implementation plans
├── CLAUDE.md             # AI developer guide
├── CHANGELOG.md
├── README.md
└── README.docker.md
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.
