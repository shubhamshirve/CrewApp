# Changelog

All notable changes to CrewBook are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
- `TestAdminLogs` class in `test_crewbook.py` — 12 integration tests covering all 6 log endpoints: shape validation, filter correctness, auth guard, and limit cap

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
- Integration test suite (`test_crewbook.py`)
