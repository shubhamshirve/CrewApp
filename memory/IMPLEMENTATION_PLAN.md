# CrewBook — Implementation Plan

## Phase 1: MVP (COMPLETED ✅)

### Backend Architecture
```
/app/backend/
├── server.py         — FastAPI entry point, CORS, startup
├── db.py             — MongoDB client via motor
├── auth_utils.py     — JWT (jose), bcrypt, get_current_user dependency
├── routers/
│   ├── auth.py       — Register, Login, /me
│   ├── users.py      — Profile, Gear Vault, ID Upload, Search, Settings
│   ├── admin.py      — Verification Queue, Approve/Reject, Stats, Penalties
│   ├── gigs.py       — Gig CRUD, Sessions, Invites, Negotiation, Workspace
│   ├── connections.py — Connect/Accept/Reject/Remove
│   ├── wallet.py     — Balance, Razorpay, Split-Payment, Referrals
│   ├── notifications.py — Get/Mark-Read
│   ├── ratings.py    — Submit, Aggregate, Appeals
│   └── ai_routes.py  — Gemini Flash Crew Suggestions
└── services/
    ├── whatsapp_mock.py        — Mock WhatsApp sender
    └── notifications_service.py — Notification helper
```

### Frontend Architecture
```
/app/frontend/src/
├── App.js            — React Router v6 routes
├── contexts/
│   └── AuthContext.js — JWT storage, axios interceptor, user state
├── components/
│   └── Layout.jsx    — Collapsible sidebar, mobile menu, unread badge
└── pages/
    ├── Landing.jsx   — Hero, features bento, pricing
    ├── Auth.jsx      — Login/Register tabs with referral code
    ├── Onboarding.jsx — 4-step wizard
    ├── Dashboard.jsx — Stats, invites, activity, gigs
    ├── Profile.jsx   — Public profile, gear, ratings, connect
    ├── Search.jsx    — Debounced search with filters
    ├── Connections.jsx — Network management with tabs
    ├── Gigs.jsx      — Gig list + create dialog
    ├── GigDetail.jsx — Sessions, team, negotiation, workspace, AI
    ├── Calendar.jsx  — Month view, standby toggle
    ├── Wallet.jsx    — Balance, Razorpay checkout, history
    ├── Notifications.jsx — Grouped list, mark read
    └── AdminDashboard.jsx — Verification queue, user mgmt
```

## Key Technical Decisions

### Auth
- JWT (7-day expiry) stored in localStorage as `crewbook_token`
- Authorization header: `Bearer <token>`
- String UUID as MongoDB `_id` (avoids ObjectId serialization pain)

### Subscription & Split Payment
1. `POST /api/wallet/subscribe/create-order` — checks wallet balance
2. If wallet covers full amount → `POST /api/wallet/subscribe/activate-wallet`
3. If partial/empty → Creates Razorpay order for remaining amount
4. After payment → `POST /api/wallet/subscribe/verify` (HMAC signature check)
5. Referral reward (₹50) credited on first subscription of referred user

### Invite Negotiation Flow
1. Lead sends invite → status: `pending`, expires: 24h
2. Freelancer can: Accept → `accepted`, Reject → `rejected`, Counter → `counter_offered`
3. Lead can accept counter → `accepted`
4. Auto-expire check on every list query

### WhatsApp (MOCKED)
- All WhatsApp sends stored in `whatsapp_logs` MongoDB collection
- Real integration: replace `services/whatsapp_mock.py` with Meta Cloud API
- `send_gig_invite_whatsapp()` — with Accept/Reject buttons
- `send_sunday_dispatch()` — weekly schedule summary

### AI (Gemini Flash)
- Model: `gemini-2.5-flash` via emergentintegrations library
- Endpoint: POST /api/ai/crew-suggestions
- Also: POST /api/ai/gig-checklist
- Session ID is unique per request to avoid context bleed

## Phase 2: Next Sprint

### P0 — Critical
- [ ] Real WhatsApp Business API (Meta Cloud API)
- [ ] Email notifications (Resend)
- [ ] PDF contract auto-generation (ReportLab/WeasyPrint)
- [ ] 90-min buffer enforcement in invite creation
- [ ] Google Calendar OAuth (mock currently)

### P1 — Important
- [ ] Post-event rating flow trigger (auto prompt after gig completion)
- [ ] Financial ledger (advance paid / balance due per gig)
- [ ] Private lead notes on freelancer profiles
- [ ] Sunday dispatch cron job (APScheduler)
- [ ] Appeal review UI in admin

### P2 — Polish
- [ ] Profile photo upload (object storage)
- [ ] Mood board image upload in workspace
- [ ] Portfolio gallery on profile
- [ ] Search with availability date filter
- [ ] Mobile PWA manifest

## Test Credentials
- Admin: admin@crewbook.in / Admin@123
- API health: GET /api/health → {"status": "ok"}
- Razorpay: Test mode (rzp_test_sFaXdx3kATIGiw)
- WhatsApp: MOCKED (check `whatsapp_logs` collection in MongoDB)
