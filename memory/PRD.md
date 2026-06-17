# CrewBook PRD — Freelance Photo & Video Crew Booking Platform

## Overview
A SaaS platform for sourcing, booking, and managing freelance crew members (second shooters, assistants, videographers) for multi-day Indian wedding events.

## Stack
- Frontend: React (dark mode, Cormorant Garamond + Outfit + Manrope fonts)
- Backend: FastAPI (Python)
- Database: MongoDB
- Payments: Razorpay (Indian market, UPI + cards)
- AI: Gemini Flash (via Emergent LLM Key)
- WhatsApp: Mocked (ready for Meta API integration)

## User Personas
1. **Lead Photographer** – Hires crew, creates gigs, negotiates fees
2. **Freelancer** – Gets hired, receives invites, manages availability
3. **Admin** – Verifies ID uploads, manages penalties, platform oversight

## Core Requirements (Static)

### Authentication
- JWT-based register/login
- Referral code support on registration
- Admin account (admin@crewbook.in / Admin@123)

### User Profiles
- Name, location, pincode, phone
- Primary + Secondary roles with day rates
- Gear Vault (cameras, lenses, drones, etc.)
- Style tags + Editing ecosystem
- Government ID upload (Aadhar/PAN/DL) + selfie
- Verification badge (admin-approved)

### Booking Engine
- Create gig with multiple sessions (parent-child structure)
- Invite freelancers with proposed fee
- Negotiation: Quote → Counter-Offer → Accept
- 24-hour invite expiration
- Status: draft → active → completed

### Calendar
- Month view with gig/session markers
- Standby mode toggle (urgent availability)
- 90-minute buffer rule enforced on backend

### Wallet & Subscriptions
- Base Plan: ₹69/month
- Premium Plan: ₹99/month (+ WhatsApp notifications)
- Razorpay integration with split-payment logic (wallet first)
- Referral reward: ₹50 credited when referred user subscribes

### Connections / Networking
- Send/accept/reject connection requests
- Ghost mode (hide from search)

### Admin Dashboard
- Verification queue (ID documents review)
- Approve/reject with reason
- Platform stats
- Penalty system (1-5 stars, auto-suspend at 5)

### Ratings
- Anonymous granular ratings (Punctuality, Gear Handling, Teamwork)
- Aggregated average displayed on profiles
- Penalty appeal system

### Notifications
- In-app notifications for all events
- WhatsApp notifications (mocked, Premium tier)

## What's Been Implemented

## What's Been Implemented

### Backend (FastAPI)
- ✅ `server.py` — Main app with all routers
- ✅ `db.py` — MongoDB connection
- ✅ `auth_utils.py` — JWT auth, password hashing
- ✅ `routers/auth.py` — Register, login, /me
- ✅ `routers/users.py` — Profiles, gear vault, ID upload, search, settings
- ✅ `routers/admin.py` — Verification queue, approve/reject, stats, penalties
- ✅ `routers/gigs.py` — Gig CRUD, sessions, invites, negotiation, workspace, handover + **90-min buffer enforcement** + **PDF contract download**
- ✅ `routers/connections.py` — Send/accept/reject connections
- ✅ `routers/wallet.py` — Wallet balance, Razorpay subscriptions, split-payment
- ✅ `routers/notifications.py` — Get/mark-read notifications
- ✅ `routers/ratings.py` — Submit ratings, aggregation, appeals
- ✅ `routers/ai_routes.py` — Gemini Flash crew suggestions & checklist
- ✅ `routers/templates.py` — **NEW** CRUD for notification templates (all channels)
- ✅ `routers/calendar_sync.py` — **NEW** Google Calendar connect/disconnect/status (MOCKED)
- ✅ `services/whatsapp_mock.py` — Mock WhatsApp sender with DB logs
- ✅ `services/notifications_service.py` — Notification helper
- ✅ `services/email_service.py` — **NEW** Resend email service (MOCKED until API key provided)
- ✅ `services/pdf_service.py` — **NEW** reportlab PDF contract generation (REAL)
- ✅ `services/calendar_service.py` — **NEW** Google Calendar mock service

### Frontend (React)
- ✅ Dark theme (Jewel & Luxury) — #0A0A0A base, #F59E0B gold accents
- ✅ `Landing.jsx` — Hero, features bento, pricing cards
- ✅ `Auth.jsx` — Login/Register with referral code
- ✅ `Onboarding.jsx` — 4-step wizard (roles, gear, ID upload)
- ✅ `Dashboard.jsx` — Stats, invites, recent activity, active gigs
- ✅ `Profile.jsx` — Public profile, gear vault, ratings, connect
- ✅ `Search.jsx` — User search with filters
- ✅ `Connections.jsx` — Network management
- ✅ `Gigs.jsx` — Gig list + create dialog
- ✅ `GigDetail.jsx` — Sessions, team assembly, negotiation, workspace, AI suggest + **Download Contract button** (PDF)
- ✅ `Calendar.jsx` — Month view with gig markers, standby toggle + **Google Calendar connect/disconnect UI** (MOCKED)
- ✅ `Wallet.jsx` — Balance, Razorpay subscriptions, transaction history
- ✅ `Notifications.jsx` — Grouped notification list
- ✅ `AdminDashboard.jsx` — Verification queue, user management, penalties
- ✅ `AdminTemplates.jsx` — **NEW** Notification template management (In-App + WhatsApp + Email tabs)
- ✅ `Layout.jsx` — Collapsible sidebar, mobile menu

## Docker Setup (Updated — MongoDB 4.4 + pnpm + Caddy)
- ✅ `backend/Dockerfile` — Python 3.11-slim, installs requirements, runs uvicorn
- ✅ `frontend/Dockerfile` — Multi-stage: **pnpm** (via corepack) build → caddy:2-alpine serve
- ✅ `frontend/Caddyfile` — Proxies `/api` to `backend:8001`, gzip, security headers, SPA fallback
- ✅ `docker-compose.yml` — 3 services: **mongo:4.4** (tuned for 1GB VPS), backend, frontend
- ✅ `frontend/pnpm-lock.yaml` — Generated from yarn.lock via `pnpm import`
- ✅ `backend/.env.example` / `frontend/.dockerignore` — Templates with all env vars documented
- ✅ `README.docker.md` — Setup guide

### CI/CD — GHCR (Added)
- ✅ `.github/workflows/ci.yml` — Builds & pushes to GHCR on `main`/`develop` push, PR builds only
  - Backend: `ghcr.io/shubhamshirve/crewapp-backend`
  - Frontend: `ghcr.io/shubhamshirve/crewapp-frontend`
  - Tags: `latest` (main only) + `sha-<short>` + branch name
  - Layer caching via GitHub Actions cache (`type=gha`)

### Security & Logic Hardening (Added)
- ✅ **Rating membership validation**: `submit_rating()` now verifies rater AND rated user are both on the same gig (as lead or accepted freelancer). Gig must be completed. Self-rating blocked. Rate-limited 10/min.
- ✅ **Rating score range**: Pydantic `ge=1, le=5` constraints on all score fields
- ✅ **Admin seed protected**: `POST /api/admin/seed-admin` requires `ADMIN_SEED_SECRET` env var + `X-Seed-Secret` header. Disabled by default. Password no longer returned in response.

### PWA (Enhanced)
- ✅ `sw.js` v3 — Cache-first for `/static/` (CRA hashed assets), network-first for navigation, offline.html fallback. Old cache cleanup on activate.
- ✅ `public/offline.html` — Dark-themed offline page matching app brand
- ✅ `manifest.json` — Added `display_override`, 3rd shortcut (My Gigs), fixed gig-board URL
- ✅ `index.html` — `black-translucent` iOS status bar, msapplication meta tags

### P0 (Critical - Next Sprint)
- [x] **PDF contract auto-generation** on booking acceptance ✅ DONE (reportlab)
- [x] **90-minute buffer enforcement** in API ✅ DONE
- [x] **Email notifications (Resend)** — Built & MOCKED, needs RESEND_API_KEY
- [x] **Google Calendar two-way sync** — UI built & MOCKED, needs Google OAuth credentials
- [x] **WhatsApp template management** — Admin Templates page built, needs Meta credentials
- [ ] Real Meta WhatsApp Business API integration (needs credentials)

### What's New — Separated Admin Panel (DONE)
- ✅ `AdminLogin.jsx` — Separate admin login at `/admin/login` (blue navy theme, shield branding)
- ✅ `AdminLayout.jsx` — Distinct admin sidebar (blue accents, separate from user app)
- ✅ Admin sub-pages: `AdminOverview`, `AdminVerification`, `AdminUsers`, `AdminPenalties`, `AdminGigBoard`
- ✅ `App.js` refactored — `RootRouter` splits `/admin/*` → AdminApp and all else → UserApp
- ✅ Admin link removed from user `Layout.jsx` — zero cross-contamination
- ✅ Admin URL: `/admin/login` → `/admin/dashboard` (separate session, separate UI)

### What's New — Public Gig Board (DONE)
- ✅ `routers/public_gigs.py` — Full CRUD: post, browse, apply, accept/reject, cancel
- ✅ `services/rewards_service.py` — Milestone rewards (5/10/25/50/100 gigs)
- ✅ `GigBoard.jsx` — Browse + My Posts + My Applications tabs
  - Browse: filter by city, role, event type, budget range; match score algorithm
  - Apply: role selection, custom offer price, cover note
  - My Posts: manage applicants (accept/reject), cancel listing
  - Converted gigs create real invite + calendar entry on acceptance
- ✅ `/gig-board` route added to App.js, "Gig Board" nav item in Layout.jsx

### 4-Feature Update (March 2026)
- ✅ **Private Notes — Connections Only**: Notes endpoint now checks `accepted` connection before allowing read/write. 403 for non-connected users. Frontend only renders notes section when `connectionStatus === "connected"`.
- ✅ **Wallet Plan Name + Expiry**: Wallet now stores `active_plan_name`, `subscription_price`, `subscription_validity`, `pending_plan_name`, `pending_plan_change_at`. GET /wallet returns all fields. UI shows plan name + expiry date with days-left badge + renew CTA (3 days before expiry).
- ✅ **Plan Validity (Monthly/Yearly)**: Plans have `validity: "monthly"/"yearly"` field. Monthly = 30 days, Yearly = 365 days. Upgrade: immediate with pro-rata refund to wallet. Downgrade: scheduled at plan tenure end. Pending change shown in Wallet UI.
- ✅ **Admin Reports Page** (`/admin/reports`): Overview stats (users, revenue, gigs), area chart for registrations, bar chart for daily revenue, payment log table. 7/14/30 day range selector.


- ✅ **Backend**: New `plans` collection + `/api/plans` CRUD router (admin create/edit/delete/migrate, public list endpoint)
- ✅ **Plan features**: `public_gig_enabled` and `whatsapp_enabled` flags per plan
- ✅ **Auto-migration**: When plan with `legacy_tier="base"/"premium"` is created, existing users auto-migrated to new plan
- ✅ **Wallet subscription**: Now uses `plan_id` (UUID from DB), sets `active_plan_id` + `active_plan_features` on user
- ✅ **Public Gig Board gating**: Access gated by `active_plan_features.public_gig_enabled`; shows upgrade wall with CTA
- ✅ **WhatsApp gating**: `send_gig_invite_whatsapp` and `send_sunday_dispatch` skip if plan doesn't have `whatsapp_enabled`
- ✅ **AdminPlans.jsx**: Full CRUD UI with feature toggles, legacy tier selector, migration button, subscriber count, active toggle
- ✅ **Wallet.jsx**: Dynamic plans loaded from DB; empty state if no plans exist; plan feature indicators shown


- ✅ **Backend**: 4 new endpoints (`gear-submissions` CRUD) in `platform_settings.py`
- ✅ **AdminSettings.jsx**: New "Gear" tab — Master Catalogue (add/filter/delete) + Custom Gear Requests (approve/edit/reject submissions from users)
- ✅ **Profile.jsx**: Gear dialog redesigned to 2-step category-first flow (7 color-coded category cards → filtered catalogue list → "Other" for custom gear with admin review)
- ✅ **Profile.jsx**: UPI Pay Now button — non-owners see green "Pay Now" UPI deeplink button; owners see their UPI ID text
- ✅ **Onboarding.jsx**: Gear section updated with category select → filtered gear dropdown → custom gear name fallback

### In-App Chat Per Gig (Done — March 2026)
- ✅ **New `gig_messages` collection** with compound index on `(gig_id, created_at)`
- ✅ **3 endpoints** in `/app/backend/routers/chat.py`: `GET /api/gigs/{id}/messages` (returns messages + unread count), `POST /api/gigs/{id}/messages` (send), `PUT /api/gigs/{id}/messages/read` (mark all read)
- ✅ **Access control**: only gig lead + accepted freelancers; non-members get 403
- ✅ **Chat tab** added to `GigDetail.jsx` with: orange sent-bubbles (right), grey received-bubbles (left), sender name for grouped messages, timestamp, auto-scroll to bottom, 4s polling when tab active, 15s background unread badge polling, Enter to send, red unread count badge on the Chat tab trigger

### Read Receipts, Snooze & Buffer Override (Done — March 2026)
- ✅ **Read Receipts on Invites**: `PUT /api/gigs/invites/{id}/mark-viewed` — auto-called when freelancer opens GigDetail; `invite_viewed_at` stored (idempotent); lead's Team tab shows "Seen [date/time]" (green Eye badge) or "Not seen yet" (grey EyeOff badge) on each pending invite
- ✅ **Snooze Invite**: `PUT /api/gigs/invites/{id}/snooze` body `{hours: 1-48, default 4}` — stores `snoozed_until` timestamp; asyncio background task sends push notification reminder when snooze expires (re-checks if still pending); freelancer sees "Snooze 4h" button + amber "Reminder set for..." indicator
- ✅ **Buffer Enforcer Override**: `POST /api/gigs/{gig_id}/invites?force=true` — skips 90-min buffer check; frontend catches HTTP 409, shows amber conflict dialog with conflict details, "Go Back" to edit, "Send Anyway" to force-create the invite
- ✅ **Password Reset via Email OTP**: `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` — same OTP infrastructure, mock mode returns `otp_dev`; "Forgot password?" link on login inline reveals OTP + new password form
- ✅ **Password Change in Profile**: `POST /api/auth/change-password` (requires current password) — dialog accessible via "Change Password" link inside profile edit panel
- ✅ **Gig Ledger Full CRUD**: `PUT /api/gigs/invites/{id}/payment` (edit amount/notes) + `DELETE /api/gigs/invites/{id}/payment/{type}` (undo/unmark) — Edit ✏️ and Undo ✕ buttons on all paid ledger entries in GigDetail.jsx
- ✅ **User Reports Tab** (`/reports` route, "Reports" in nav): 6 tabs — Overview (summary stats dual role), Bookings (freelancer history), Payments (received), Pending (dues with lead contact), Monthly (bar mini-chart with earned/pending), Gig Expenses (crew payments as lead); all batch-queried efficiently
- ✅ **Docker — Caddy replaces nginx**: `Caddyfile` with gzip, security headers, SPA fallback, API proxy; updated `docker-compose.yml` with caddy_data/caddy_config volumes
- ✅ **Docker — npm replaces yarn**: `frontend/Dockerfile` updated to use `npm ci` for reproducible builds
- ✅ **Pincode API auto-fill**: `src/utils/pincode.js` using `api.postalpincode.in` — auto-fills City & State on blur in both Registration and Profile edit forms; shows loading/valid/invalid states
- ✅ **Email OTP on Registration**: `POST /api/auth/send-otp` generates 6-digit OTP (mock returns `otp_dev` in response when no Resend key), `POST /api/auth/verify-otp` returns 15-min `email_verified_token`, `POST /api/auth/register` requires the token. OTP: 10-min TTL, max 5 attempts, 60s resend cooldown. MongoDB TTL index auto-cleans expired OTPs.

### Production Hardening (Done — March 2026)
- ✅ **Rate limiting** via `slowapi`: Register 3/min, Login 10/min, Global 200/min per IP
- ✅ **Input validation**: Pydantic v2 field_validators on all write endpoints (email format, password strength, phone, enums, length limits, URL format, UPI format)
- ✅ **Regex injection prevention**: `re.escape()` on all MongoDB text search inputs
- ✅ **N+1 query fixes**: Batch-fetch freelancers in `gigs.get_gig`, batch-fetch gigs in `get_received_invites`, batch-fetch applications in `public_gigs.browse`, batch-fetch applicants in `public_gigs.get_detail`
- ✅ **Security headers middleware**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- ✅ **JWT secret hardened**: Random 256-bit secret in .env, fail-fast if missing
- ✅ **Docker hardened**: Non-root user in backend (uid 1001), yarn in frontend, resource limits (512m backend, 128m frontend), PYTHONDONTWRITEBYTECODE/PYTHONUNBUFFERED set
- ✅ **nginx.conf upgraded**: Security headers, CSP, rate-limit body size (15m), block .env/.git paths
- ✅ **FastAPI lifespan** replaces deprecated `@app.on_event`, docs hidden in production

### P1 (Important)
- [x] **Post-event rating flow trigger** ✅ DONE — Dashboard banner + rating modal with sliders
- [x] **Private lead notes on freelancer profiles** ✅ DONE — Profile page section, only visible to note author
- [x] **Financial ledger (advance paid / balance due)** ✅ DONE — Ledger tab in GigDetail, 50/50 split default, Mark Paid buttons
- [x] **Admin Appeal Review UI** ✅ DONE — AdminPenalties rewritten with 2 tabs (Penalty Log + Appeals), approve/reject with star removal
- [ ] Sunday dispatch cron job
- [ ] Appeal review UI for admin

### P2 (Nice to Have)
- [ ] Portfolio gallery upload
- [ ] Event workspace: photo upload for mood boards
- [ ] Mobile app (React Native)
- [ ] Referral leaderboard
- [ ] No-Show penalty (30-day suspension) — explicitly deferred by user

### Deployment & Infrastructure (Done — Feb 2026)
- ✅ MongoDB downgraded to 4.4 (1 GB VPS memory constraint)
- ✅ Frontend build switched to **pnpm 9** (corepack)
- ✅ Frontend served by **Caddy** (replaces nginx) — gzip + SPA fallback
- ✅ PWA support — `manifest.json`, `sw.js`, offline page, `InstallAppButton`
- ✅ **Smart in-app install prompt** (`Layout.jsx`) — surfaces only on 2nd+ visit, 7-day snooze on dismiss, iOS Safari "Add to Home Screen" instructions modal as fallback (no `beforeinstallprompt` on iOS)
- ✅ **Slim requirements.txt** — removed `emergentintegrations`, `litellm`, `openai`, all `google-*` SDKs, `boto3`, `stripe`, `pandas`, `numpy`, `tiktoken`, `huggingface_hub`, dev-only tools (black/isort/mypy/flake8). 133 → 56 packages. Regression guard at `backend/tests/test_imports_sanity.py`.
- ✅ CI/CD via GitHub Actions → GHCR (`.github/workflows/ci.yml`)
- ✅ DB helper scripts: `scripts/seed_data.py`, `scripts/reset_db.py`
- ✅ **Unified multi-app VPS deploy** (`deploy/deploy.sh`) — non-destructive co-hosting of CrewBook (`crew.mmpf.in`) + JVSapp (`app.mmpf.in`) on `45.196.196.114`:
  - Host Caddy terminates TLS for both domains
  - JVSapp port re-mapping via `docker-compose.override.yml` with `!override` tag (no edits to JVSapp's repo files)
  - Trivial decommission path when either app moves to a dedicated server (just delete the override + Caddy block)

## Environment Notes
- Backend: PORT 8001, MongoDB via MONGO_URL
- Frontend: PORT 3000, uses REACT_APP_BACKEND_URL
- Admin: admin@crewbook.in / Admin@123
- Razorpay: Test keys configured
- Gemini: Emergent LLM Key (sk-emergent-4710cB2646aF63eC14)
- WhatsApp: MOCKED — logs stored in `whatsapp_logs` collection
- Email: MOCKED — logs stored in `email_logs` collection (add RESEND_API_KEY to .env to activate)
- Google Calendar: MOCKED — connect/disconnect stored in DB (add Google OAuth to activate)
