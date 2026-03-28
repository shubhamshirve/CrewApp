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

## Docker Setup (Added)
- ✅ `backend/Dockerfile` — Python 3.11-slim, installs requirements, runs uvicorn
- ✅ `frontend/Dockerfile` — Multi-stage: Node 20 build → nginx:alpine serve
- ✅ `frontend/nginx.conf` — Proxies `/api` to `backend:8001`, serves React SPA
- ✅ `docker-compose.yml` — 3 services: mongodb, backend, frontend with health checks
- ✅ `backend/.dockerignore` / `frontend/.dockerignore` / `.dockerignore`
- ✅ `backend/.env.example` / `frontend/.env.example` — Templates without secrets
- ✅ `README.docker.md` — Complete setup guide with commands, architecture diagram, troubleshooting

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

### P1 (Important)
- [ ] Post-event rating flow trigger
- [ ] Private lead notes on freelancer profiles
- [ ] Financial ledger (advance paid / balance due)
- [ ] Sunday dispatch cron job
- [ ] Appeal review UI for admin

### P2 (Nice to Have)
- [ ] Portfolio gallery upload
- [ ] Event workspace: photo upload for mood boards
- [ ] Mobile app (React Native)
- [ ] Referral leaderboard

## Environment Notes
- Backend: PORT 8001, MongoDB via MONGO_URL
- Frontend: PORT 3000, uses REACT_APP_BACKEND_URL
- Admin: admin@crewbook.in / Admin@123
- Razorpay: Test keys configured
- Gemini: Emergent LLM Key (sk-emergent-4710cB2646aF63eC14)
- WhatsApp: MOCKED — logs stored in `whatsapp_logs` collection
- Email: MOCKED — logs stored in `email_logs` collection (add RESEND_API_KEY to .env to activate)
- Google Calendar: MOCKED — connect/disconnect stored in DB (add Google OAuth to activate)
