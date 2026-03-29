# CrewBook — Product Roadmap

> Last updated: Feb 2026  
> Stack: React + FastAPI + MongoDB | Indian wedding & event photography/videography crew platform

---

## Legend
- `[x]` Done
- `[-]` In Progress / Partial
- `[ ]` Not Started
- **P0** = Critical (next sprint) | **P1** = Important | **P2** = Nice to Have | **P3** = Future / Backlog

---

## Currently Being Built (This Sprint)

- [-] **Read Receipts on Invites** — Freelancers' "Seen" timestamp visible to leads on invite cards
- [-] **Snooze Invite ("Remind me in 4h")** — Freelancers can defer an invite; push notification fires when snooze expires
- [-] **Buffer Enforcer Override** — 90-min conflict shows warning dialog with "Send Anyway (Force)" option for lead

---

## Admin Panel Features

### P0
- [ ] **Feature Flag Manager** — Admin UI to toggle features (public gig board, WhatsApp, AI suggest, etc.) per user segment or plan
- [ ] **Promo Code Engine** — Admin UI to create, edit, expire discount codes; apply on subscription checkout
- [ ] **Dispute Resolution Center** — Admin reviews disputes raised on gigs (freelancer vs lead); resolve with decision + penalty
- [ ] **Booking Audit Trail** — Full timeline of every state change for a gig/invite (created, sent, viewed, accepted, snoozed, etc.)

### P1
- [ ] **Admin Gig Board Moderation** — Review & approve/reject public gig listings before they go live
- [ ] **Bulk User Actions** — Batch suspend/verify/migrate-plan for selected users from the user list
- [ ] **Revenue Breakdown Report** — Per-plan, per-period subscription revenue with churn tracking
- [ ] **Referral Leaderboard (Admin view)** — Top referrers ranked with payout history

### P2
- [ ] **Admin Impersonation Audit Log** — Log every admin impersonation with timestamp + actions taken
- [ ] **Custom Notification Templates** — Admin can edit in-app / WhatsApp / Email template body per event type
- [ ] **Platform Announcement Banner** — Admin sets a dismissible banner visible to all users on Dashboard

---

## User Features

### P0
- [ ] **Portfolio Gallery** — Freelancers upload work samples (photos/videos) to their profile; stored via object storage; visible on public profile
- [ ] **Auto-Invoice PDF** — Per-gig invoice with GST breakdown (18% GST), client details, line items per session; downloadable by lead
- [ ] **In-App Chat Per Gig** — Real-time or async message thread per gig between lead and accepted freelancers

### P1
- [ ] **Availability Broadcast** — "Free this weekend" button sends push notification to all connections
- [ ] **Rewards & Gamification** — Badges (First Gig, 10 Gigs, 50 Gigs, etc.); milestone display on profile
- [ ] **Crew Packages** — Freelancer bundles multiple roles (e.g., Video + Drone operator) as a single hireable package
- [ ] **Calendar Sync (Google Calendar)** — Replace mock with real 2-way OAuth sync; accepted sessions auto-added to Google Calendar
- [ ] **Real Email Notifications (Resend)** — Replace mock `email_service.py` with live Resend API; all invite/booking/OTP emails go live
- [ ] **Real WhatsApp Notifications (Meta)** — Replace mock with live Meta Business API; premium-tier users get WhatsApp alerts
- [ ] **Sunday Dispatch Cron** — Weekly digest email to freelancers listing open gigs matching their role/city
- [ ] **Private Notes (Lead → Freelancer)** — Lead can add private notes on a freelancer's profile (only visible to that lead)

### P2
- [ ] **Geo-Radius Search** — Search freelancers within X km of a pincode using MongoDB geospatial index
- [ ] **Advance Payment via Platform** — Razorpay Escrow: lead pays advance through platform, released to freelancer post-event
- [ ] **Referral Leaderboard (User view)** — Public leaderboard showing top referrers in the community
- [ ] **Event Mood Board Upload** — Upload actual image files to Workspace (currently text/URL only); stored via object storage
- [ ] **Profile Video Reel** — Freelancer uploads a short video reel shown on their public profile
- [ ] **Bulk Session Upload** — Import sessions from CSV for multi-day events (50+ session wedding itineraries)

### P3 (Backlog)
- [ ] **Mobile App (React Native)** — Native iOS/Android app with PWA feature parity
- [ ] **AI-Powered Gig Matching** — Gemini suggests best-fit freelancers for a gig based on ratings, gear, location, availability
- [ ] **Voice Note in Workspace** — Record and attach short audio notes to workspace items
- [ ] **Escrow Release Confirmation** — Dual-confirmation (lead + freelancer) before platform releases balance payment
- [ ] **Crew Availability Calendar (Public)** — Freelancer can expose a public availability calendar link (like Calendly)
- [ ] **Multi-Currency Support** — For international gigs (USD, EUR) with INR conversion display

---

## Production & Infrastructure

### P0
- [ ] **Real Resend API Key** — Add `RESEND_API_KEY` to `.env`; email mock will auto-activate
- [ ] **VAPID Push Keys** — Generate & store production VAPID keys for live push notifications
- [ ] **MongoDB Atlas Migration** — Move from local MongoDB to Atlas for production reliability + backups

### P1
- [ ] **Background Task Runner** — Celery + Redis (or APScheduler) for: snooze reminders, Sunday dispatch, expiry cleanup
- [ ] **Object Storage (S3 / GCS)** — For portfolio uploads, mood board images, profile video reels
- [ ] **Razorpay Webhook Handler** — `POST /api/payments/webhook` to confirm subscription payments server-side
- [ ] **Rate Limit Tuning** — Per-endpoint fine-tuning; tighten OTP and auth endpoints further
- [ ] **Sentry Error Monitoring** — Integrate Sentry SDK for backend + frontend error tracking

### P2
- [ ] **CDN for Static Assets** — Serve frontend build via CloudFront/Cloudflare CDN
- [ ] **Horizontal Scaling** — Multi-instance FastAPI behind a load balancer with MongoDB connection pooling
- [ ] **End-to-End Test Suite** — Playwright E2E tests for critical flows (register → create gig → invite → accept → ledger)
- [ ] **CI/CD Pipeline** — GitHub Actions: lint → test → Docker build → deploy on merge to main
- [ ] **GDPR / Data Export** — `GET /api/me/export` returns all user data as JSON for data portability

---

## Completed (Historical)

### Core Platform
- [x] JWT Auth (register, login, /me, referral code)
- [x] Email OTP on Registration + Password Reset
- [x] Pincode API auto-fill (City & State)
- [x] User Profile (roles, gear vault, ID upload, style tags)
- [x] Admin verification queue (approve/reject)
- [x] Booking Engine (Gig CRUD, sessions, invites, negotiation)
- [x] 90-minute buffer rule (backend enforcement)
- [x] PDF Contract generation (reportlab)
- [x] Financial Ledger with full CRUD (advance/balance, edit/undo)
- [x] Digital Wallet + Razorpay subscriptions (Base/Premium plans)
- [x] Connections/Networking (send/accept/reject, ghost mode)
- [x] Anonymous ratings (Punctuality, Gear Handling, Teamwork)
- [x] Penalty system (1–5 stars, auto-suspend at 5)
- [x] AI Crew Suggestions (Gemini Flash)
- [x] Push Notifications (PWA + VAPID)
- [x] Notification click routing
- [x] Public Gig Board (browse, apply, convert to invite)
- [x] Plan-based feature gating (public gig, WhatsApp)
- [x] Custom Gear Submissions + Admin approval workflow
- [x] UPI deep-link "Pay Now" button on user profiles
- [x] Admin impersonation (same-tab, PWA-safe)
- [x] User Reports Dashboard (6 analytics tabs)
- [x] Admin Reports Page (overview, revenue charts)
- [x] Admin Plans CRUD (feature flags, legacy tier migration)
- [x] Docker setup (Caddy + uvicorn)
- [x] Rate limiting (slowapi), input validation, security headers
- [x] N+1 query optimizations
