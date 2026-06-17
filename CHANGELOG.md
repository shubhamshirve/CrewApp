# Changelog

All notable changes to Photoo are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0] — 2025-07-17 — Security Hardening · Docker 4.4 · CI/CD GHCR · PWA v3

### Added

**Security & Logic Fixes**
- `backend/routers/ratings.py` — **Rating score range validation**: `punctuality`, `gear_handling`, `teamwork` now have `ge=1, le=5` Pydantic field constraints; invalid values return HTTP 422
- `backend/routers/ratings.py` — **Same-booking membership check**: `submit_rating()` now verifies both the rater and the rated user are actually on the same gig (as lead or accepted freelancer). Previously any authenticated user could rate any user on any gig by knowing the `gig_id`. Returns HTTP 403 if not a member.
- `backend/routers/ratings.py` — **Self-rating guard**: Returns HTTP 400 when rater == rated user
- `backend/routers/ratings.py` — **Gig completion check**: Ratings are only accepted after `gig.status == "completed"` (HTTP 400 otherwise)
- `backend/routers/ratings.py` — **Rate limiting**: 10 requests/minute per user on `POST /api/ratings`
- `backend/routers/admin.py` — **Seed endpoint protection**: `POST /api/admin/seed-admin` now requires `ADMIN_SEED_SECRET` env var + `X-Seed-Secret` header; endpoint is **completely disabled** (HTTP 403) when env var is unset
- `backend/routers/admin.py` — Admin default password moved to `ADMIN_DEFAULT_PASSWORD` env var (no longer hardcoded); password no longer returned in the response body
- `backend/routers/gigs.py` — **90-min buffer for lead**: `add_session()` now validates the 90-minute booking buffer for the lead photographer when adding a new session to an existing gig

**Performance**
- `backend/routers/ratings.py` — Rating aggregate rewritten with MongoDB `$group + $avg` pipeline; replaces `to_list(1000)` Python-side loop that would scan all ratings on every submit

**Infrastructure — Docker**
- `docker-compose.yml` — MongoDB version `7.0` → **`4.4`** (tuned for 1 GB VPS); healthcheck updated from `mongosh` → `mongo` shell; memory limits: MongoDB 256 MB · backend 384 MB · frontend 128 MB
- `frontend/Dockerfile` — Migrated from yarn to **pnpm** via `corepack enable && corepack prepare pnpm@9 --activate`; uses `pnpm install --frozen-lockfile` for reproducible builds
- `frontend/pnpm-lock.yaml` — Generated from existing `yarn.lock` via `pnpm import`
- `frontend/.dockerignore` — Updated: excludes `yarn.lock`, keeps `pnpm-lock.yaml`
- `backend/.env.example` — Comprehensive env var template with inline documentation

**CI/CD — GHCR**
- `.github/workflows/ci.yml` — GitHub Actions pipeline:
  - Triggers: push to `main`/`develop`, PR builds to `main`
  - Builds backend + frontend Docker images in parallel
  - Pushes to `ghcr.io/shubhamshirve/crewapp-backend` and `ghcr.io/shubhamshirve/crewapp-frontend`
  - Tags: `latest` (main only), `sha-<short>`, branch name
  - GitHub Actions cache (`type=gha`) for layer caching
  - PRs build but do not push (validation only)

**PWA v3**
- `frontend/public/sw.js` — Service Worker rewritten (v3):
  - Cache-first for `/static/*` (CRA content-hashed assets — immutable)
  - Cache-first for icons + manifest
  - Network-first for SPA navigation with `offline.html` fallback
  - Old cache cleanup on `activate` event
  - Proper `skipWaiting()` + `clients.claim()` for instant takeover
- `frontend/public/offline.html` — New dark-themed offline fallback page matching app brand
- `frontend/public/manifest.json` — Added `display_override: ["window-controls-overlay", ...]`, third shortcut (My Gigs), fixed gig-board URL
- `frontend/public/index.html` — `apple-mobile-web-app-status-bar-style` → `black-translucent`; added `msapplication-TileColor` + `msapplication-TileImage` meta tags

**Developer Experience**
- `scripts/seed_data.py` — Inserts realistic demo data: 6 users (admin + 5 crew), 2 plans, 2 gigs (1 completed with ratings, 1 active), invites, connections, coupons, chat messages, notifications. Fully idempotent (skips existing records). Works locally and inside Docker.
- `scripts/reset_db.py` — Drops all 30 collections with confirmation prompt. Supports `--yes`, `--seed`, `--collections`, `--list` flags. Calls `seed_data.py` when `--seed` is passed.
- `Makefile` — Developer convenience targets: `make up/down/logs/build`, `make seed/reset/reset-seed`, `make health`, `make test-backend/lint-backend/lint-frontend`
- `README.md` — Fully rewritten for GitHub: feature table, tech stack, quick start, scripts docs, env var reference table, CI/CD section, ASCII architecture diagram, project structure tree

---

## [1.8] — 2026-03-29 — Light, Minimal, Rounded UI Overhaul

### Changed

**Frontend — Complete Theme Transition (Dark → Light)**
- Replaced dark luxury theme (`#0A0A0A` / `#131315` backgrounds) with Light, Minimal, Rounded UI across all 24 React pages and components
- CSS variables in `index.css` and `tailwind.config.js` already updated in 1.7; this release completes the component-level conversion
- **Design tokens:** Page background `#F9F9F8` (`bg-background`), cards `bg-white border border-border rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]`, primary accent `#E05D26` Cinematic Amber (`bg-primary`), admin accent blue (`bg-blue-600`)
- **Typography:** Replaced all `Cormorant Garamond` inline `fontFamily` style props with `font-display` class (Outfit); Manrope for body text
- **Buttons:** All primary buttons `bg-primary text-primary-foreground rounded-full`; all ghost/outline buttons `border-border text-slate-600 rounded-full`
- **Inputs:** All form inputs `bg-slate-50 border-border text-foreground placeholder:text-muted-foreground rounded-xl`

**Pages converted:**
- `Landing.jsx` — full rewrite with alabaster hero image, light navbar, feature cards, pricing cards
- `Auth.jsx` — light card, TabsList, inputs, submit buttons
- `Onboarding.jsx` — light stepper, upload zones, gear chips
- `AdminLogin.jsx` — light card, blue admin accent
- `Dashboard.jsx` — stat cards, section panels, modals
- `GigBoard.jsx` — all 3 modals (Post, Apply, Manage), gig cards, tab bar, filters
- `Gigs.jsx`, `GigDetail.jsx`, `Profile.jsx` — cards, badges, dialogs, gear vault, ratings
- `Search.jsx`, `Connections.jsx`, `Notifications.jsx` — result cards, unread highlight
- `Wallet.jsx`, `Calendar.jsx` — plan cards, balance display, calendar grid
- `AdminDashboard.jsx` — stat cards, user lists, verification dialogs
- `admin/AdminOverview.jsx`, `AdminVerification.jsx`, `AdminPenalties.jsx`
- `admin/AdminUsers.jsx`, `AdminUserProfile.jsx`
- `admin/AdminSettings.jsx`, `AdminTemplates.jsx`, `AdminLogs.jsx`, `AdminGigBoard.jsx`

**Auth**
- Unified admin and user login into a single `/auth` page — admins log in via the same form and are automatically redirected to `/admin/dashboard` based on the `is_admin` flag
- Removed separate `AdminLogin.jsx` page and `/admin/login` route; both now redirect to `/auth`
- `AdminGuard` updated to redirect unauthenticated/non-admin users to `/auth`

**Docs**
- `CLAUDE.md` — updated design system section; added Agent Protocol (read on start, update on finish)

---

## [1.5] — 2026-03-28 — Admin Logs & Monitoring

### Added

**Backend**
- `backend/services/log_service.py` — `log_admin_action()` fire-and-forget helper; writes to `admin_logs` collection with admin ID, email, action, target, before/after snapshots
- Admin audit logging on all mutation routes: `verify_user`, `reject_user`, `bulk_action`, `wallet_adjust`, `set_flags`, `add_penalty`, `toggle_suspend`
- Six new `GET /api/admin/logs/*` read endpoints (all admin-guarded, paginated, sorted by `created_at` desc):
  - `/admin/logs/admin-actions` — filter by `action`
  - `/admin/logs/api-errors` — filter by `status_code`
  - `/admin/logs/payments` — filter by `event`
  - `/admin/logs/ai-usage`
  - `/admin/logs/whatsapp`
  - `/admin/logs/logins` — filter by `user_id`
- `server.py` — global `HTTPException` and `Exception` handlers that write to `api_error_logs` before re-raising; fire-and-forget
- `server.py` — startup indexes on all 6 log collections: `[("created_at", -1)]`
- `routers/wallet.py` — `payment_logs` inserts at 3 Razorpay lifecycle points: `order_created`, `payment_verified`, `payment_failed`, `wallet_covered`
- `routers/ai_routes.py` — `ai_usage_logs` inserts after each Gemini Flash call; cost estimate: `(prompt_chars + response_chars) / 1000 * 0.001` INR
- `services/whatsapp_mock.py` — `whatsapp_logs` now include `user_id`, `template`, `status`, `created_at` fields

**Frontend**
- `frontend/src/pages/admin/AdminLogs.jsx` — new admin page at `/admin/logs` with 6 Radix tabs: Activity, API Errors, Payments, AI Usage, WhatsApp, Login Audit
- Each tab: filter bar (dropdowns or text search), paginated table (Prev/Next, "Showing X–Y of Z"), IST timestamps, truncated long values with tooltip
- `AdminLayout.jsx` — added "Logs" nav item with `ScrollText` icon between Gig Board and Settings
- `App.js` — `/admin/logs` route wired with `AdminGuard`

**Tests**
- `TestAdminLogs` class in `test_photoo.py` — 12 integration tests covering all 6 log endpoints: shape validation, filter correctness, auth guard, and limit cap

### Fixed
- `log_admin_action()` now uses `admin.get("id", "unknown")` and `before or {}` / `after or {}` to handle None inputs safely
- `update_user_flags` in `admin.py` now captures `before_flags` snapshot before the `update_one` call
- `verify_payment` in `wallet.py` restructured so `payment_failed` log is written before raising `HTTPException(400)`

---

## [1.4] — 2026-03-28 — Admin User Management

### Added

**Backend**
- `GET /api/admin/users` — search (`?search=`) and filter (`?plan=`, `?status=`, `?verified=`) params
- `GET /api/admin/users/{id}/profile` — aggregated deep-dive: user, gigs, invites, wallet transactions, wallet adjustments, ratings, login logs
- `POST /api/admin/impersonate/{id}` — issues a 1-hour JWT scoped to a target user; self-impersonation blocked
- `POST /api/admin/wallet/{id}/adjust` — credit or debit a user's wallet balance with mandatory reason
- `PUT /api/admin/users/{id}/flags` — set `is_featured` and/or `is_high_risk` flags
- `auth_utils.create_impersonation_token()` — short-lived JWT helper
- Login events recorded in `login_logs` collection on every successful auth

**Frontend**
- `AdminUsers` — filter bar (search, plan, status, verified), checkboxes, bulk action toolbar (verify, suspend, unsuspend, notify)
- `AdminUserProfile` — 5-tab deep-dive page: Overview, Gigs, Wallet, Activity, Ratings; impersonation button opens new tab
- Admin impersonation: token stored in `sessionStorage` so the new tab picks it up via `AuthContext`

**Tests**
- `TestAdminUsersFilters` — search by name, filter by plan, filter by suspended status
- `TestAdminUserProfile` — profile shape, no password hash, 404 on missing user
- `TestAdminBulkAction` — suspend, unsuspend, verify, notify, invalid action
- `TestAdminImpersonate` — token returned, token authenticates as user, 404 on missing
- `TestAdminWalletAdjust` — credit increases balance, debit decreases, zero rejected, empty reason rejected
- `TestAdminUserFlags` — set featured, set high-risk, 404 on missing

### Fixed
- Bulk action loader not dismissed on error (state leak fix)
- Admin cannot impersonate themselves

---

## [1.0–1.3] — Initial Build

### Added

- User registration, login, JWT auth (`/api/auth/*`)
- User profiles with onboarding flow
- Gig creation, listing, and detail pages
- Crew connections (follow/request)
- Wallet with Razorpay subscription plans (base / premium)
- In-app notifications
- Gig board (public gig listings)
- Calendar view for scheduled gigs
- AI crew suggestions and gig checklist via Gemini Flash
- Admin panel: overview stats, verification queue, penalties, gig board, settings
- WhatsApp notifications (simulated)
- Docker Compose setup with nginx, FastAPI, MongoDB
- Integration test suite (`test_photoo.py`)
