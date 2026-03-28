# Admin Logs & Monitoring — Design Spec
**Date:** 2026-03-28
**Branch:** 1.4
**Status:** Approved

---

## Overview

Add a standalone Logs & Monitoring page to the CrewBook admin panel. Six log categories are captured at their write points (inline) and displayed in a paginated, filterable admin UI at `/admin/logs`.

The existing admin architecture is preserved: `AdminLayout`, `/admin/*` routes guarded by `AdminGuard`, FastAPI `admin.py` router.

---

## Data Model — MongoDB Collections

### `admin_logs` (new)
Written by `log_admin_action()` helper after every admin mutation.
```json
{
  "_id": "uuid",
  "admin_id": "uuid",
  "admin_email": "string",
  "action": "string",
  "target_type": "string",
  "target_id": "string",
  "before": {},
  "after": {},
  "created_at": "ISO datetime"
}
```
Example actions: `verify_user`, `suspend_user`, `unsuspend_user`, `bulk_verify`, `bulk_suspend`, `bulk_notify`, `wallet_credit`, `wallet_debit`, `set_flags`, `add_penalty`.

### `api_error_logs` (new)
Written by FastAPI exception handler middleware.
```json
{
  "_id": "uuid",
  "status_code": 400,
  "method": "POST",
  "path": "/api/auth/login",
  "user_id": "uuid or null",
  "error_detail": "string",
  "traceback": "string (500s only)",
  "created_at": "ISO datetime"
}
```

### `payment_logs` (new)
Written inline in `wallet.py` at each Razorpay lifecycle event.
```json
{
  "_id": "uuid",
  "user_id": "uuid",
  "event": "order_created | payment_verified | payment_failed | wallet_covered",
  "razorpay_order_id": "string or null",
  "razorpay_payment_id": "string or null",
  "amount_paise": 6900,
  "plan": "base | premium",
  "status": "success | failed",
  "detail": "string",
  "created_at": "ISO datetime"
}
```

### `ai_usage_logs` (new)
Written inline in `ai_routes.py` after each Gemini response.
```json
{
  "_id": "uuid",
  "user_id": "uuid",
  "endpoint": "crew-suggestions | gig-checklist",
  "session_id": "string",
  "model": "gemini-2.5-flash",
  "prompt_chars": 450,
  "response_chars": 820,
  "cost_estimate_inr": 0.00127,
  "created_at": "ISO datetime"
}
```
Cost formula: `(prompt_chars + response_chars) / 1000 * 0.001` INR (adjustable constant).

### `whatsapp_logs` (new)
Written in `whatsapp_mock.py` after each send attempt.
```json
{
  "_id": "uuid",
  "user_id": "uuid",
  "phone": "string",
  "template": "string",
  "status": "sent | failed",
  "simulated": true,
  "created_at": "ISO datetime"
}
```

### `login_logs` (existing)
Already written in `auth.py` on successful login: `{ _id, user_id, ip, user_agent, created_at }`.

---

## Backend Changes

### `services/log_service.py` (new, thin)
Single async helper to avoid repeating the insert boilerplate across admin routes:
```python
async def log_admin_action(db, admin: dict, action: str, target_type: str,
                           target_id: str, before: dict, after: dict): ...
```

### `server.py`
Add two exception handlers:
- `@app.exception_handler(HTTPException)` — writes `api_error_logs` for 4xx, re-raises
- `@app.exception_handler(Exception)` — writes `api_error_logs` for 5xx with `traceback.format_exc()`, re-raises as 500

Both receive `request: Request` as first argument. Extract `user_id` from `request.state` if set by auth dependency (best-effort, nullable — anonymous requests log `null`).

### `routers/admin.py`

**Existing mutation routes — add `log_admin_action()` calls:**

| Route | Action string | Before/After |
|-------|--------------|-------------|
| `POST /admin/verification/{id}` | `verify_user` / `reject_user` | `verification_status` field |
| `POST /admin/users/bulk-action` | `bulk_{action}` | summary of user_ids affected |
| `POST /admin/users/{id}/wallet-adjust` | `wallet_credit` / `wallet_debit` | wallet balance before/after |
| `PUT /admin/users/{id}/flags` | `set_flags` | flags before/after |
| `POST /admin/penalties/{id}` | `add_penalty` | penalty record |

**New read endpoints (all `GET`, all guarded by `get_admin_user`):**

```
GET /admin/logs/admin-actions   ?limit=50&skip=0&action=
GET /admin/logs/api-errors      ?limit=50&skip=0&status_code=
GET /admin/logs/payments        ?limit=50&skip=0&event=
GET /admin/logs/ai-usage        ?limit=50&skip=0
GET /admin/logs/whatsapp        ?limit=50&skip=0
GET /admin/logs/logins          ?limit=50&skip=0&user_id=
```

All return `{ "items": [...], "total": int }`. Max `limit` capped at 100. Results sorted by `created_at` descending.

### `routers/wallet.py`
Add `payment_logs` inserts:
- In `create_subscription_order`: log `order_created` (or `wallet_covered` for full-wallet-cover path)
- In `verify_payment`: log `payment_verified` on success, `payment_failed` **before raising** the `HTTPException(400)` on bad signature (do not rely on error middleware for this case)

### `routers/ai_routes.py`
After each `chat.send_message()` call, insert `ai_usage_logs` document. Compute `prompt_chars` from the prompt string length, `response_chars` from `len(response)`.

### `services/whatsapp_mock.py`
Add `user_id: str` parameter to `send_whatsapp_message()`. All callers must pass the user's ID. After each simulated send, insert `whatsapp_logs` document.

### `server.py` — startup indexes
```python
await db.admin_logs.create_index([("created_at", -1)])
await db.api_error_logs.create_index([("created_at", -1)])
await db.payment_logs.create_index([("created_at", -1)])
await db.ai_usage_logs.create_index([("created_at", -1)])
await db.whatsapp_logs.create_index([("created_at", -1)])
await db.login_logs.create_index([("created_at", -1)])
```

---

## Frontend

### New page: `frontend/src/pages/admin/AdminLogs.jsx`
Route: `/admin/logs`

**Layout:** Single page with a 6-tab layout, matching existing AdminSettings style (dark luxury theme, `#0F1628` card backgrounds, blue active tabs, `font-display`).

**Tabs:** Activity | API Errors | Payments | AI Usage | WhatsApp | Login Audit

**Per-tab structure:**
- Filter bar: 1–2 relevant dropdowns (see below), plus a Refresh button
- Paginated table: Prev / Next, showing "Showing X–Y of Z"
- Monospace timestamps (formatted to IST locale)
- Long values (error detail, traceback, before/after JSON) truncated with `title` tooltip

**Tab details:**

| Tab | Filter options | Key columns |
|-----|---------------|-------------|
| Activity | Action type dropdown | Timestamp, Admin email, Action, Target type + ID, Before→After (JSON diff) |
| API Errors | Status code dropdown (4xx / 5xx) | Timestamp, Status, Method + Path, User ID, Error detail |
| Payments | Event dropdown | Timestamp, User ID, Event, Amount (₹), Plan, Status, Order ID |
| AI Usage | Endpoint dropdown | Timestamp, User ID, Endpoint, Session ID, Chars (prompt/response), Cost ₹ |
| WhatsApp | Status dropdown (sent/failed) | Timestamp, User ID, Phone, Template, Status, Simulated badge |
| Login Audit | — (user_id text search) | Timestamp, User ID, IP address, User agent |

**Navigation:** Add "Logs" nav item to `AdminLayout` sidebar with a `ScrollText` lucide icon, linking to `/admin/logs`. Position it between Settings and the last nav item.

---

## Error Handling

- Log writes are fire-and-forget: wrap each insert in `try/except` and log to Python logger on failure — never let a logging failure break the actual request.
- API error middleware re-raises after writing so the client still gets the correct HTTP response.
- Frontend: empty state message per tab ("No logs yet"), spinner on load, toast on fetch failure.

---

## Out of Scope

- Log retention / TTL policies
- Export to CSV / external systems
- Real-time streaming (WebSocket)
- WhatsApp real delivery receipts (simulated only for now)
- Token counting via Gemini API (char-based estimate only)
