# Admin User Management — Design Spec
**Date:** 2026-03-28
**Branch:** 1.3
**Status:** Approved

---

## Overview

Extend the existing CrewBook admin panel (branch 1.3) with six new capabilities:
1. Full user table with search + filters
2. User profile deep-dive page
3. Bulk actions (suspend, verify, notify)
4. Impersonation (admin opens user app as that user)
5. Manual wallet credit/debit with reason log
6. Role override (featured / high-risk flags)

The existing 1.3 admin architecture is preserved: separate `AdminLayout`, dedicated pages per concern, `/admin/*` routes guarded by `AdminGuard`.

---

## Architecture

### Approach
Option B — enhanced list page + dedicated profile page.

- `AdminUsers` gets filter bar + checkboxes + bulk-action toolbar
- New `AdminUserProfile` page at `/admin/users/:id` with 5 tabs
- All per-user actions (impersonate, wallet adjust, flag override) live on the profile page

---

## Backend Changes

### `backend/routers/auth.py`
- On `POST /auth/login` success: insert a document into `login_logs` collection
  ```
  { _id: uuid, user_id, ip, user_agent, created_at }
  ```
- IP extracted from `Request.client.host`; user-agent from `Request.headers.get("user-agent")`

### `backend/routers/admin.py`

**Enhanced: `GET /admin/users`**
Add optional query params:
- `search: str` — matches full_name or email (case-insensitive)
- `role: str` — matches primary_role
- `city: str` — matches location
- `plan: str` — matches subscription_plan (free/base/premium)
- `status: str` — matches verification_status (pending/approved/rejected) or `suspended`
- `min_rating: float`, `max_rating: float` — filters on avg_rating

**New: `GET /admin/users/{user_id}/profile`**
Returns aggregated profile:
```json
{
  "user": { ...full user doc minus password_hash },
  "gigs": [ ...gigs where owner_id == user_id, limit 50 ],
  "invites": [ ...connections where sender_id or receiver_id == user_id, limit 50 ],
  "wallet_transactions": [ ...wallet_transactions where user_id == user_id, limit 50 ],
  "wallet_adjustments": [ ...wallet_adjustments where user_id == user_id ],
  "ratings": [ ...ratings where ratee_id == user_id, limit 50 ],
  "login_logs": [ ...login_logs where user_id == user_id, limit 50, sorted desc ]
}
```

**New: `POST /admin/users/bulk-action`**
Body:
```json
{
  "action": "suspend" | "unsuspend" | "verify" | "notify",
  "user_ids": ["uuid", ...],
  "title": "string (notify only)",
  "message": "string (notify only)"
}
```
- `suspend`: sets `is_suspended: true` for all user_ids
- `unsuspend`: sets `is_suspended: false`
- `verify`: sets `is_verified: true`, `verification_status: "approved"`
- `notify`: calls `send_notification` for each user_id
Returns: `{ "updated": int }`

**New: `POST /admin/impersonate/{user_id}`**
- Verifies user exists
- Issues a new JWT: `sub = user_id`, `exp = now + 1 hour`, extra claim `impersonated_by = admin_id`
- Uses same `JWT_SECRET` and `python-jose` as existing auth
- Returns: `{ "token": str, "expires_in": 3600 }`

**New: `POST /admin/wallet/{user_id}/adjust`**
Body: `{ "amount": float, "type": "credit" | "debit", "reason": str }`
- Validates amount > 0
- Credits or debits `wallet_balance` on user doc
- Inserts into `wallet_adjustments`: `{ _id, user_id, admin_id, type, amount, reason, created_at }`
- Inserts into `wallet_transactions`: `{ _id, user_id, type: "admin_credit"/"admin_debit", amount, description: reason, created_at }`
- Returns: `{ "new_balance": float }`

**New: `PUT /admin/users/{user_id}/flags`**
Body: `{ "is_featured": bool (optional), "is_high_risk": bool (optional) }`
- Updates only provided fields on user doc
- Returns: `{ "is_featured": bool, "is_high_risk": bool }`

### New MongoDB Collections
| Collection | Purpose |
|---|---|
| `login_logs` | Login event per user (IP, user-agent, timestamp) |
| `wallet_adjustments` | Admin credit/debit audit log |

### User Document — New Fields
| Field | Type | Default |
|---|---|---|
| `is_featured` | bool | false |
| `is_high_risk` | bool | false |

---

## Frontend Changes

### `frontend/src/pages/admin/AdminUsers.jsx` (enhanced)

**Filter bar** (between search and list):
- 4 dropdowns: Role, Plan, Status, City (all optional)
- Rating range: min/max number inputs
- "Clear filters" button
- On any filter change: re-fetch from `GET /admin/users` with params

**Checkboxes + bulk toolbar:**
- Each row gets a checkbox on the left
- Header checkbox = select/deselect all visible
- When ≥1 checked: sticky toolbar at page bottom appears with:
  - Count label ("3 users selected")
  - "Suspend" button → POST bulk-action suspend
  - "Verify" button → POST bulk-action verify
  - "Notify" button → opens small modal (title + message inputs) → POST bulk-action notify
  - "Clear" button

**Row click:** clicking user name navigates to `/admin/users/:id`

---

### `frontend/src/pages/admin/AdminUserProfile.jsx` (new)

Route: `/admin/users/:id`

**Header:**
- Back button → `/admin/users`
- Avatar, full name, email, phone, location
- Status badges: verified, plan, suspended, featured, high-risk
- "Impersonate" button (blue) — calls POST `/admin/impersonate/:id`, stores token in `sessionStorage` as `crewbook_token`, opens `/dashboard` in new tab
- Action buttons: Suspend/Unsuspend toggle, Apply Penalty (existing modal)

**5 tabs:**

1. **Overview**
   - Profile details grid (all user fields)
   - Featured toggle (PUT /admin/users/:id/flags `{is_featured}`)
   - High-Risk toggle (PUT /admin/users/:id/flags `{is_high_risk}`)
   - Wallet balance + "Credit / Debit" button → opens modal

2. **Gigs**
   - Table: title, event_type, date, status, slots
   - Empty state if none

3. **Wallet**
   - Combined timeline of `wallet_transactions` + `wallet_adjustments`
   - Sorted by `created_at` desc
   - Admin adjustments shown with "Admin" badge
   - "Add Credit / Debit" button at top-right

4. **Ratings**
   - Avg rating shown at top
   - List of individual ratings: rater name, stars, comment, date

5. **Login History**
   - Table: IP address, user-agent (truncated), date/time
   - Most recent first, limit 50

**Wallet Adjust Modal:**
- Amount input (number, > 0)
- Type select: Credit / Debit
- Reason textarea (required)
- Submit → POST `/admin/wallet/:id/adjust`

---

### `frontend/src/App.js` (new route)
```jsx
<Route path="/admin/users/:id" element={<AdminGuard><AdminUserProfile /></AdminGuard>} />
```

---

## Impersonation Flow

1. Admin clicks "Impersonate" on `/admin/users/:id`
2. POST `/admin/impersonate/{user_id}` → returns `{ token }`
3. Frontend stores token in `sessionStorage` under key `crewbook_token`
4. Opens `window.open("/dashboard", "_blank")`
5. New tab boots, `AuthContext` reads `crewbook_token` from `localStorage` first, then `sessionStorage` — user app loads as impersonated user
6. Token expires in 1 hour automatically

> **Note:** `AuthContext` currently reads from `localStorage`. A small tweak is needed: check `sessionStorage` as fallback so impersonation works in the new tab without polluting the admin's own session.

---

## Constraints & Notes

- Impersonation token is read-only by convention only — the impersonated user's JWT is fully valid. Admin should be aware actions taken will appear as the user.
- `wallet_adjustments` is a separate collection from `wallet_transactions` for clean audit separation.
- Login IP tracking begins from the point of deployment — no historical data backfill.
- Bulk notify uses existing `send_notification` (in-app only, no real email/SMS).
- `is_featured` / `is_high_risk` flags are stored on the user doc but no automated behavior is attached yet — they are display flags for admin visibility and future use.
- Filters in AdminUsers are applied server-side (query params) not client-side, to support pagination correctly.
