# CLAUDE.md — CrewBook Developer Guide

This file tells Claude Code how to work in this repository.

---

## Project Overview

**CrewBook** is a freelance crew booking platform for the Indian film/events industry. Users post gigs, connect with crew members, manage subscriptions, and communicate via WhatsApp. Admins manage users, handle verification, and monitor platform activity.

**Stack:**
- **Backend:** Python 3.11, FastAPI, Motor (async MongoDB driver)
- **Frontend:** React 18, Tailwind CSS, Radix UI, lucide-react, axios
- **Database:** MongoDB 7.0
- **Payments:** Razorpay
- **AI:** Google Gemini Flash (`gemini-2.5-flash`) via `emergent_llm`
- **Notifications:** WhatsApp (mocked in dev, `whatsapp_logs` collection)
- **Infra:** Docker Compose with nginx reverse proxy

---

## Project Structure

```
CrewBook/
├── backend/
│   ├── routers/          # FastAPI route handlers (one file per domain)
│   │   ├── admin.py      # All /api/admin/* routes
│   │   ├── auth.py       # Registration, login, /me
│   │   ├── wallet.py     # Razorpay subscriptions, wallet balance
│   │   ├── ai_routes.py  # Gemini AI endpoints
│   │   └── ...
│   ├── services/
│   │   ├── log_service.py      # log_admin_action() helper
│   │   └── whatsapp_mock.py    # Simulated WhatsApp send
│   ├── db.py             # Motor client + db singleton
│   ├── auth_utils.py     # JWT encode/decode, get_current_user
│   ├── server.py         # FastAPI app, exception handlers, startup
│   └── tests/
│       └── test_crewbook.py    # Integration tests (requests, live server)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── admin/    # All admin pages (AdminOverview, AdminUsers, etc.)
│       │   └── ...       # User-facing pages
│       ├── components/
│       │   └── AdminLayout.jsx   # Admin sidebar + nav
│       ├── contexts/
│       │   └── AuthContext.js    # Auth state + stable axios instance
│       └── lib/
│           └── api.js    # Axios instance (baseURL from env)
├── docs/superpowers/
│   ├── specs/            # Approved design docs (YYYY-MM-DD-*.md)
│   └── plans/            # Implementation plans (YYYY-MM-DD-*.md)
├── README.md
├── README.docker.md
└── CHANGELOG.md
```

---

## Key Conventions

### Backend

**Dependency injection:** Every route that needs auth uses `get_current_user` or `get_admin_user` as a FastAPI `Depends`. Never read the JWT manually in a route.

**Database access:** Use `db = get_db()` (imported from `db.py`) at the top of each route function. `db` is a Motor async database handle.

**IDs:** All documents use string UUIDs as `_id` (not ObjectId). Generated with `str(uuid.uuid4())`. When returning user-facing data, map `_id` → `id`.

**Fire-and-forget logging:** Every log write (admin_logs, api_error_logs, payment_logs, ai_usage_logs, whatsapp_logs) is wrapped in `try/except`. A logging failure must never break the parent request.

**Admin audit trail:** Every admin mutation route must call `await log_admin_action(db, admin, action, target_type, target_id, before, after)` from `services/log_service.py`. Capture `before` snapshot *before* the DB mutation.

**Error responses:** Use `raise HTTPException(status_code=..., detail="...")`. The global exception handlers in `server.py` auto-log all 4xx/5xx to `api_error_logs`.

**AI cost estimate:** `(prompt_chars + response_chars) / 1000 * 0.001` INR. Constant is `_AI_COST_PER_1K_CHARS_INR = 0.001` in `ai_routes.py`.

### Frontend

**Design system:** Dark luxury theme. Card backgrounds `#0F1628`, page background `#080B12`, blue active accents. Source of truth: `docs/design_guidelines.json`.

**API calls:** Always import the shared axios instance: `import api from "@/lib/api"`. Never create a new `axios.create()` in a component.

**Admin pages:** All admin pages live in `frontend/src/pages/admin/`, are wrapped in `<AdminLayout>`, and are guarded by `<AdminGuard>` in `App.js`.

**Adding a nav item:** Edit the `ADMIN_NAV` array in `frontend/src/components/AdminLayout.jsx`. Import the lucide icon, add `{ path, icon, label }` in the correct position.

**Adding a route:** Add both the `import` and the `<Route>` inside `AdminRoutes()` in `frontend/src/App.js`.

**Timestamps:** Always format to IST: `new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })`.

---

## MongoDB Collections

| Collection | Written by | Purpose |
|---|---|---|
| `users` | auth.py | User accounts |
| `gigs` | gigs.py | Gig postings |
| `connections` | connections.py | Follow/connect graph |
| `notifications` | various | In-app notifications |
| `wallet_transactions` | wallet.py | Payment history |
| `login_logs` | auth.py | Every login event |
| `admin_logs` | log_service.py | Admin mutation audit trail |
| `api_error_logs` | server.py | All 4xx/5xx errors |
| `payment_logs` | wallet.py | Razorpay lifecycle events |
| `ai_usage_logs` | ai_routes.py | Gemini usage + cost |
| `whatsapp_logs` | whatsapp_mock.py | WhatsApp send attempts |

All log collections have a `[("created_at", -1)]` index created at startup.

---

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
npm install
npm start
```

Or use Docker:
```bash
docker compose up --build
curl -X POST http://localhost/api/admin/seed-admin
```

Admin credentials: `admin@crewbook.in` / `Admin@123`

---

## Running Tests

```bash
# From repo root (requires a running backend)
cd backend
REACT_APP_BACKEND_URL=http://localhost:8001 pytest tests/test_crewbook.py -v
```

Tests are real HTTP integration tests against a live server — no mocks, no fixtures spinning up their own server. Test users/gigs created during the run are prefixed `TEST_` for easy identification.

---

## Branch Strategy

- `main` — stable, deployed branch
- `1.x` — feature branches (one per sprint/feature set)
- Always branch from `main`, PR back to `main`

Current active branch: `1.5`

---

## Design Docs

Before implementing a significant feature:
1. Create a spec in `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`
2. Create an implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`

Both are committed to the repo as part of the feature branch.
