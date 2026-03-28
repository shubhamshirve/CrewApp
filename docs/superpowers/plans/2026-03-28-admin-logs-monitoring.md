# Admin Logs & Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six instrumented log streams (admin actions, API errors, payments, AI usage, WhatsApp, login audit) with a standalone `/admin/logs` viewer page in the admin panel.

**Architecture:** Inline writes at each event source (no central bus); a thin `log_service.py` helper for the shared admin-action case; FastAPI exception handlers for API errors; six paginated GET endpoints in `admin.py`; a single `AdminLogs.jsx` page with tab-per-stream UI.

**Tech Stack:** FastAPI + Motor (MongoDB), React + Radix Tabs, Lucide icons, Tailwind/dark luxury theme, requests-based integration tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/services/log_service.py` | `log_admin_action()` async helper |
| Create | `frontend/src/pages/admin/AdminLogs.jsx` | Standalone Logs & Monitoring page |
| Modify | `backend/routers/admin.py` | Log calls on mutations + 6 GET log endpoints |
| Modify | `backend/routers/wallet.py` | `payment_logs` inserts |
| Modify | `backend/routers/ai_routes.py` | `ai_usage_logs` inserts |
| Modify | `backend/services/whatsapp_mock.py` | Add `user_id`, `status`, `created_at` fields |
| Modify | `backend/routers/gigs.py` | Thread `freelancer["_id"]` into WhatsApp call |
| Modify | `backend/server.py` | Exception handlers + 6 startup indexes |
| Modify | `backend/tests/test_crewbook.py` | `TestLogs` integration tests |
| Modify | `frontend/src/components/AdminLayout.jsx` | Add Logs nav item |
| Modify | `frontend/src/App.js` | Import + route `/admin/logs` |

---

## Task 1: Create `log_service.py`

**Files:**
- Create: `backend/services/log_service.py`

- [ ] **Step 1: Create the file**

```python
# backend/services/log_service.py
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def log_admin_action(
    db,
    admin: dict,
    action: str,
    target_type: str,
    target_id: str,
    before: dict,
    after: dict,
) -> None:
    """Fire-and-forget admin audit log. Never raises."""
    try:
        await db.admin_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "admin_id": admin["id"],
            "admin_email": admin.get("email", ""),
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id),
            "before": before,
            "after": after,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("Failed to write admin_log action=%s: %s", action, exc)
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/log_service.py
git commit -m "feat: add log_service.py with log_admin_action helper"
```

---

## Task 2: Instrument Admin Mutation Routes

**Files:**
- Modify: `backend/routers/admin.py`

- [ ] **Step 1: Add import at top of `admin.py`**

After the existing imports, add:
```python
from services.log_service import log_admin_action
```

- [ ] **Step 2: Instrument `verify_user` (line ~52)**

After the `await db.users.update_one(...)` block and before the `send_notification` call, add:
```python
    await log_admin_action(
        db, admin, "verify_user" if is_approved else "reject_user",
        "user", user_id,
        {"verification_status": user.get("verification_status")},
        {"verification_status": data.action},
    )
```

- [ ] **Step 3: Instrument `bulk_action` (line ~176)**

After the `if/elif` block that performs the action, before `return {"updated": updated}`, add:
```python
    await log_admin_action(
        db, admin, f"bulk_{data.action}",
        "users", ",".join(data.user_ids[:10]),
        {},
        {"action": data.action, "count": updated},
    )
```

- [ ] **Step 4: Instrument `adjust_wallet` (line ~230)**

After `await db.wallet_transactions.insert_one(...)` and before `send_notification`, add:
```python
    await log_admin_action(
        db, admin, f"wallet_{data.type}",
        "user", user_id,
        {"wallet_balance": current_balance},
        {"wallet_balance": new_balance, "amount": data.amount, "reason": data.reason},
    )
```

- [ ] **Step 5: Instrument `update_user_flags` (line ~280)**

After `await db.users.update_one(...)` (before the `updated = await db.users.find_one` line), add:
```python
    before_flags = {
        "is_featured": user.get("is_featured", False),
        "is_high_risk": user.get("is_high_risk", False),
    }
    await log_admin_action(
        db, admin, "set_flags",
        "user", user_id,
        before_flags,
        {k: v for k, v in updates.items() if k != "updated_at"},
    )
```

- [ ] **Step 6: Instrument `add_penalty` (line ~318)**

After `await db.users.update_one(...)` (before `send_notification`), add:
```python
    await log_admin_action(
        db, admin, "add_penalty",
        "user", user_id,
        {"negative_stars": user.get("negative_stars", 0), "is_suspended": user.get("is_suspended", False)},
        {"negative_stars": new_stars, "is_suspended": is_suspended, "reason": data.reason},
    )
```

- [ ] **Step 7: Instrument `toggle_suspend` (line ~348)**

After `await db.users.update_one(...)`, add:
```python
    await log_admin_action(
        db, admin, "toggle_suspend",
        "user", user_id,
        {"is_suspended": not new_state},
        {"is_suspended": new_state},
    )
```

- [ ] **Step 8: Commit**

```bash
git add backend/routers/admin.py
git commit -m "feat: instrument admin mutation routes with audit logging"
```

---

## Task 3: Add Log Read Endpoints to `admin.py`

**Files:**
- Modify: `backend/routers/admin.py`

- [ ] **Step 1: Add the six GET endpoints at the end of `admin.py`**

Append after the last existing route:

```python
# ── Log Read Endpoints ─────────────────────────────────────────────────────────

@router.get("/logs/admin-actions")
async def get_admin_action_logs(
    limit: int = 50,
    skip: int = 0,
    action: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if action:
        query["action"] = action
    items = await db.admin_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}


@router.get("/logs/api-errors")
async def get_api_error_logs(
    limit: int = 50,
    skip: int = 0,
    status_code: Optional[int] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if status_code:
        query["status_code"] = status_code
    items = await db.api_error_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.api_error_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}


@router.get("/logs/payments")
async def get_payment_logs(
    limit: int = 50,
    skip: int = 0,
    event: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if event:
        query["event"] = event
    items = await db.payment_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.payment_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}


@router.get("/logs/ai-usage")
async def get_ai_usage_logs(
    limit: int = 50,
    skip: int = 0,
    endpoint: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if endpoint:
        query["endpoint"] = endpoint
    items = await db.ai_usage_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ai_usage_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}


@router.get("/logs/whatsapp")
async def get_whatsapp_logs(
    limit: int = 50,
    skip: int = 0,
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if status:
        query["status"] = status
    items = await db.whatsapp_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.whatsapp_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}


@router.get("/logs/logins")
async def get_login_logs(
    limit: int = 50,
    skip: int = 0,
    user_id: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    limit = min(limit, 100)
    query = {}
    if user_id:
        query["user_id"] = user_id
    items = await db.login_logs.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.login_logs.count_documents(query)
    for item in items:
        item["id"] = str(item.pop("_id"))
    return {"items": items, "total": total}
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/admin.py
git commit -m "feat: add six log read endpoints to admin router"
```

---

## Task 4: API Error Middleware + Startup Indexes

**Files:**
- Modify: `backend/server.py`

- [ ] **Step 1: Add imports at top of `server.py`**

After the existing imports, add:
```python
import uuid
import traceback as tb_module
from datetime import datetime, timezone
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
```

- [ ] **Step 2: Add exception handlers after `app = FastAPI(...)` and before `api_router = APIRouter(...)`**

```python
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    user_id = getattr(request.state, "user_id", None)
    try:
        await db.api_error_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "status_code": exc.status_code,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "error_detail": str(exc.detail),
            "traceback": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as log_err:
        logger.error("api_error_log write failed: %s", log_err)
    return await _default_http_handler(request, exc)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    user_id = getattr(request.state, "user_id", None)
    try:
        await db.api_error_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "status_code": 500,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "error_detail": str(exc),
            "traceback": tb_module.format_exc(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as log_err:
        logger.error("api_error_log write failed: %s", log_err)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
```

- [ ] **Step 3: Add six collection indexes inside the `startup()` function**

After the existing `create_index` calls, append:
```python
    await db.admin_logs.create_index([("created_at", -1)])
    await db.api_error_logs.create_index([("created_at", -1)])
    await db.payment_logs.create_index([("created_at", -1)])
    await db.ai_usage_logs.create_index([("created_at", -1)])
    await db.whatsapp_logs.create_index([("created_at", -1)])
    await db.login_logs.create_index([("created_at", -1)])
```

- [ ] **Step 4: Commit**

```bash
git add backend/server.py
git commit -m "feat: add API error logging middleware and collection indexes"
```

---

## Task 5: Payment Logging in `wallet.py`

**Files:**
- Modify: `backend/routers/wallet.py`

- [ ] **Step 1: Add `db` import and uuid/datetime are already imported — verify they exist**

Check top of `wallet.py` has `import uuid` and `from datetime import datetime, timezone`. If not, add them. Both are already present per the file read.

- [ ] **Step 2: Log `wallet_covered` in `activate_with_wallet`**

After `await db.wallet_transactions.insert_one(tx)` and before `await _check_and_reward_referrer(...)`, add:
```python
    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "wallet_covered",
            "razorpay_order_id": None,
            "razorpay_payment_id": None,
            "amount_paise": int(bill_rs * 100),
            "plan": data.plan,
            "status": "success",
            "detail": f"Full wallet cover: ₹{bill_rs:.2f}",
            "created_at": now.isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
```

- [ ] **Step 3: Log `order_created` in `create_subscription_order`**

After `order = rp.order.create(...)`, before `return {...}`, add:
```python
    try:
        db_log = get_db()
        await db_log.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "order_created",
            "razorpay_order_id": order.get("id"),
            "razorpay_payment_id": None,
            "amount_paise": remaining_paise,
            "plan": data.plan,
            "status": "pending",
            "detail": f"Razorpay order created",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
```

Note: `create_subscription_order` doesn't call `get_db()` before this point (it's called early for settings); `db` is already assigned as `db = get_db()` at line ~78. Use `db` directly:
```python
    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "order_created",
            "razorpay_order_id": order.get("id"),
            "razorpay_payment_id": None,
            "amount_paise": remaining_paise,
            "plan": data.plan,
            "status": "pending",
            "detail": "Razorpay order created",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
```

- [ ] **Step 4: Restructure and instrument `verify_payment`**

The current function raises before `db = get_db()`. Replace the entire function with:

```python
@router.post("/subscribe/verify")
async def verify_payment(data: VerifyPaymentRequest, current_user: dict = Depends(get_current_user)):
    rp = get_razorpay_client()
    db = get_db()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()

    try:
        rp.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature,
        })
    except Exception:
        try:
            await db.payment_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "event": "payment_failed",
                "razorpay_order_id": data.razorpay_order_id,
                "razorpay_payment_id": data.razorpay_payment_id,
                "amount_paise": None,
                "plan": data.plan,
                "status": "failed",
                "detail": "Signature verification failed",
                "created_at": now.isoformat(),
            })
        except Exception as log_err:
            logger.error("payment_log write failed: %s", log_err)
        raise HTTPException(status_code=400, detail="Payment verification failed")

    wallet_balance = current_user.get("wallet_balance", 0.0)
    new_balance = max(0.0, wallet_balance - data.wallet_deducted)

    cfg = await _get_platform_settings(db)
    plan_price_rs = float(cfg.get(f"{data.plan}_plan_price",
                                  _DEFAULT_BASE_PRICE_RS if data.plan == "base" else _DEFAULT_PREMIUM_PRICE_RS))
    plan_name = cfg.get(f"{data.plan}_plan_name", data.plan.capitalize() + " Plan")

    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$set": {
            "wallet_balance": new_balance,
            "subscription_plan": data.plan,
            "subscription_expires_at": expires_at,
            "whatsapp_enabled": data.plan == "premium",
        }}
    )
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": plan_price_rs,
        "description": f"Subscription: {plan_name} (via Razorpay)",
        "reference": data.razorpay_payment_id,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
    await _check_and_reward_referrer(db, current_user)
    await send_notification(
        db, current_user["id"], "subscription",
        "Subscription Activated!", f"Your {plan_name} is now active."
    )
    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "payment_verified",
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "amount_paise": int(plan_price_rs * 100),
            "plan": data.plan,
            "status": "success",
            "detail": f"Subscription activated: {plan_name}",
            "created_at": now.isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
    return {"message": "Payment verified. Subscription active!", "plan": data.plan, "expires_at": expires_at}
```

Also ensure `logger = logging.getLogger(__name__)` exists at the top of `wallet.py`. If it doesn't, add it after the imports.

- [ ] **Step 5: Commit**

```bash
git add backend/routers/wallet.py
git commit -m "feat: add payment_logs instrumentation to wallet routes"
```

---

## Task 6: AI Usage Logging in `ai_routes.py`

**Files:**
- Modify: `backend/routers/ai_routes.py`

- [ ] **Step 1: Add imports at top of `ai_routes.py`**

Add after the existing imports:
```python
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_AI_COST_PER_1K_CHARS_INR = 0.001  # adjust as Gemini pricing updates
```

- [ ] **Step 2: Log after `crew-suggestions` response**

In `get_crew_suggestions`, replace:
```python
        response = await chat.send_message(UserMessage(text=prompt))
        return {"suggestion": response, "session_id": session_id}
```
with:
```python
        response = await chat.send_message(UserMessage(text=prompt))
        try:
            total_chars = len(prompt) + len(response)
            await db.ai_usage_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "endpoint": "crew-suggestions",
                "session_id": session_id,
                "model": "gemini-2.5-flash",
                "prompt_chars": len(prompt),
                "response_chars": len(response),
                "cost_estimate_inr": round(total_chars / 1000 * _AI_COST_PER_1K_CHARS_INR, 6),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error("ai_usage_log write failed: %s", e)
        return {"suggestion": response, "session_id": session_id}
```

Also add `db = get_db()` at the start of `get_crew_suggestions` (before the `try` block — currently no db call exists in this route):
```python
    db = get_db()
    try:
        from emergentintegrations.llm.chat import ...
```

- [ ] **Step 3: Log after `gig-checklist` response**

In `get_gig_checklist`, similarly add `db = get_db()` at start and replace the return:
```python
        response = await chat.send_message(UserMessage(text=prompt))
        session_id = chat.session_id  # checklist doesn't set session_id upfront
        try:
            total_chars = len(prompt) + len(response)
            await db.ai_usage_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "endpoint": "gig-checklist",
                "session_id": f"checklist_{current_user['id'][:8]}",
                "model": "gemini-2.5-flash",
                "prompt_chars": len(prompt),
                "response_chars": len(response),
                "cost_estimate_inr": round((len(prompt) + len(response)) / 1000 * _AI_COST_PER_1K_CHARS_INR, 6),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error("ai_usage_log write failed: %s", e)
        return {"checklist": response}
```

Note: `get_gig_checklist` creates `chat` with `session_id=f"checklist_{uuid.uuid4().hex[:12]}"` inline. Use the same pattern for the log: `session_id=f"checklist_{current_user['id'][:8]}"` is a stable per-user approximation. Alternatively, capture the generated session_id:
```python
        checklist_session = f"checklist_{uuid.uuid4().hex[:12]}"
        chat = LlmChat(..., session_id=checklist_session, ...)...
        # then use checklist_session in the log
```
Use this approach — save the session_id to a variable before creating LlmChat.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/ai_routes.py
git commit -m "feat: add ai_usage_logs instrumentation to AI routes"
```

---

## Task 7: WhatsApp Logging — Update `whatsapp_mock.py` and Caller

**Files:**
- Modify: `backend/services/whatsapp_mock.py`
- Modify: `backend/routers/gigs.py`

- [ ] **Step 1: Update `send_whatsapp_message` signature and record in `whatsapp_mock.py`**

Replace the entire function:
```python
async def send_whatsapp_message(
    db,
    phone: str,
    message: str,
    msg_type: str = "notification",
    buttons: list = None,
    user_id: str = None,
):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "phone": phone,
        "message": message,
        "type": msg_type,
        "template": msg_type,
        "buttons": buttons or [],
        "status": "sent",
        "simulated": True,
        "sent_at": now,
        "created_at": now,
    }
    await db.whatsapp_logs.insert_one(record)
    logger.info(f"[WhatsApp MOCK] To: {phone} | Type: {msg_type} | Msg: {message[:80]}")
    return {"status": "simulated", "message_id": record["_id"]}
```

- [ ] **Step 2: Update `send_gig_invite_whatsapp` to accept and pass `user_id`**

Replace the function signature and the inner call:
```python
async def send_gig_invite_whatsapp(
    db, phone: str, freelancer_name: str, gig_title: str,
    fee: float, invite_id: str, user_id: str = None,
):
    message = (
        f"Hi {freelancer_name}! You have a new gig invite for '{gig_title}'. "
        f"Proposed fee: ₹{fee:.0f}. "
        f"Reply ACCEPT_{invite_id} or REJECT_{invite_id}"
    )
    buttons = [
        {"type": "reply", "id": f"ACCEPT_{invite_id}", "title": "Accept"},
        {"type": "reply", "id": f"REJECT_{invite_id}", "title": "Reject"},
    ]
    return await send_whatsapp_message(db, phone, message, "gig_invite", buttons, user_id=user_id)
```

- [ ] **Step 3: Update `send_sunday_dispatch` to accept `user_id`**

Replace signature (body unchanged, just add param + pass through):
```python
async def send_sunday_dispatch(db, phone: str, user_name: str, gigs_summary: list, user_id: str = None):
    ...
    return await send_whatsapp_message(db, phone, message, "sunday_dispatch", user_id=user_id)
```

- [ ] **Step 4: Update caller in `gigs.py`**

In `gigs.py`, find the `send_gig_invite_whatsapp` call (~line 188):
```python
        await send_gig_invite_whatsapp(
            db, freelancer["phone"], freelancer["full_name"],
            gig["title"], data.proposed_fee, invite["_id"]
        )
```
Replace with:
```python
        await send_gig_invite_whatsapp(
            db, freelancer["phone"], freelancer["full_name"],
            gig["title"], data.proposed_fee, invite["_id"],
            user_id=freelancer["_id"],
        )
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/whatsapp_mock.py backend/routers/gigs.py
git commit -m "feat: add user_id/status/created_at fields to WhatsApp log records"
```

---

## Task 8: Frontend — `AdminLogs.jsx`, Layout, Routing

**Files:**
- Create: `frontend/src/pages/admin/AdminLogs.jsx`
- Modify: `frontend/src/components/AdminLayout.jsx`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create `AdminLogs.jsx`**

```jsx
// frontend/src/pages/admin/AdminLogs.jsx
import React, { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ScrollText, RefreshCw, ChevronLeft, ChevronRight,
  Activity, AlertCircle, CreditCard, Cpu, MessageSquare, LogIn,
} from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const selectClass =
  "bg-zinc-900 border border-white/10 text-zinc-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500/60 font-display";

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
}

function trunc(val, n = 55) {
  if (val === null || val === undefined) return "—";
  const s = typeof val === "object" ? JSON.stringify(val) : String(val);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function Pill({ label, color = "blue" }) {
  const map = {
    blue:  "bg-blue-500/10  text-blue-300  border-blue-500/20",
    red:   "bg-red-500/10   text-red-300   border-red-500/20",
    green: "bg-green-500/10 text-green-300 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    zinc:  "bg-zinc-700/30  text-zinc-400  border-zinc-700/30",
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border font-display ${map[color] || map.zinc}`}>
      {label}
    </span>
  );
}

function LogTable({ columns, rows, loading, total, skip, onSkipChange }) {
  const from = total === 0 ? 0 : skip + 1;
  const to   = Math.min(skip + PAGE_SIZE, total);
  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-zinc-600 text-xs text-center py-12 font-display">No logs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="text-left text-zinc-500 font-display text-[11px] pb-2 pr-4 border-b border-white/5 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id || i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="py-2 pr-4 text-zinc-300 align-top"
                      title={col.rawTitle
                        ? (typeof row[col.rawTitle] === "object"
                          ? JSON.stringify(row[col.rawTitle])
                          : String(row[col.rawTitle] ?? ""))
                        : undefined}
                    >
                      {col.render
                        ? col.render(row)
                        : <span className="font-mono">{trunc(row[col.key])}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <span className="text-[11px] text-zinc-500 font-display">{from}–{to} of {total}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-white/10 text-zinc-400"
              onClick={() => onSkipChange(skip - PAGE_SIZE)} disabled={skip === 0}>
              <ChevronLeft size={12} />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-white/10 text-zinc-400"
              onClick={() => onSkipChange(skip + PAGE_SIZE)} disabled={to >= total}>
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function useLogFetch(api, endpoint) {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [skip,    setSkip]    = useState(0);
  const [filters, setFilters] = useState({});

  const load = useCallback(async (s, f) => {
    setLoading(true);
    try {
      const params = { limit: PAGE_SIZE, skip: s, ...f };
      Object.keys(params).forEach(k => { if (params[k] === "" || params[k] === undefined) delete params[k]; });
      const res = await api.get(`${endpoint}?${new URLSearchParams(params)}`);
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [api, endpoint]);

  useEffect(() => { load(0, {}); }, [load]);

  const handleSkip   = (s) => { setSkip(s); load(s, filters); };
  const handleFilter = (key, val) => {
    const f = { ...filters, [key]: val };
    setFilters(f); setSkip(0); load(0, f);
  };
  const refresh = () => load(skip, filters);

  return { items, total, loading, skip, filters, handleSkip, handleFilter, refresh };
}

// ── Tab components ────────────────────────────────────────────────────────────

function ActivityTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/admin-actions");
  const ACTIONS = ["","verify_user","reject_user","bulk_suspend","bulk_unsuspend",
                   "bulk_verify","bulk_notify","wallet_credit","wallet_debit",
                   "set_flags","add_penalty","toggle_suspend"];
  const columns = [
    { key: "created_at",  label: "Time",       render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at)}</span> },
    { key: "admin_email", label: "Admin",      render: r => <span className="font-mono text-blue-300">{trunc(r.admin_email, 28)}</span> },
    { key: "action",      label: "Action",     render: r => <Pill label={r.action} color="blue" /> },
    { key: "target_type", label: "Target",     render: r => <span className="font-mono text-zinc-400">{r.target_type}</span> },
    { key: "target_id",   label: "Target ID",  render: r => <span className="font-mono text-zinc-500 text-[10px]">{trunc(r.target_id, 16)}</span> },
    { key: "before", label: "Before → After", rawTitle: "before", render: r => (
      <div className="space-y-0.5 max-w-xs">
        <div className="font-mono text-zinc-500 text-[10px]">{trunc(JSON.stringify(r.before), 40)}</div>
        <div className="font-mono text-green-400 text-[10px]">{trunc(JSON.stringify(r.after), 40)}</div>
      </div>
    )},
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.action || ""} onChange={e => handleFilter("action", e.target.value)}>
          {ACTIONS.map(a => <option key={a} value={a}>{a || "All actions"}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function ApiErrorsTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/api-errors");
  const columns = [
    { key: "created_at",   label: "Time",         render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at)}</span> },
    { key: "status_code",  label: "Status",        render: r => <Pill label={r.status_code} color={r.status_code >= 500 ? "red" : "amber"} /> },
    { key: "method",       label: "Method + Path", render: r => <span className="font-mono"><span className="text-zinc-500">{r.method} </span><span className="text-zinc-300">{trunc(r.path, 38)}</span></span> },
    { key: "user_id",      label: "User",          render: r => <span className="font-mono text-zinc-500 text-[10px]">{trunc(r.user_id || "anon", 16)}</span> },
    { key: "error_detail", label: "Error",         rawTitle: "error_detail", render: r => <span className="font-mono text-red-300">{trunc(r.error_detail, 50)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.status_code || ""} onChange={e => handleFilter("status_code", e.target.value)}>
          <option value="">All codes</option>
          {["400","401","403","404","422","500"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function PaymentsTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/payments");
  const columns = [
    { key: "created_at",         label: "Time",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",            label: "User",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{trunc(r.user_id, 16)}</span> },
    { key: "event",              label: "Event",    render: r => <Pill label={r.event} color={r.event === "payment_failed" ? "red" : r.event === "payment_verified" ? "green" : "blue"} /> },
    { key: "amount_paise",       label: "Amount",   render: r => <span className="font-mono text-white">{r.amount_paise != null ? `₹${(r.amount_paise/100).toFixed(2)}` : "—"}</span> },
    { key: "plan",               label: "Plan",     render: r => r.plan ? <Pill label={r.plan} color="zinc" /> : <span className="text-zinc-600">—</span> },
    { key: "status",             label: "Status",   render: r => <Pill label={r.status || "—"} color={r.status === "success" ? "green" : r.status === "failed" ? "red" : "zinc"} /> },
    { key: "razorpay_order_id",  label: "Order ID", render: r => <span className="font-mono text-zinc-500 text-[10px]">{trunc(r.razorpay_order_id, 20)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.event || ""} onChange={e => handleFilter("event", e.target.value)}>
          <option value="">All events</option>
          {["order_created","wallet_covered","payment_verified","payment_failed"].map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function AiUsageTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/ai-usage");
  const columns = [
    { key: "created_at",        label: "Time",       render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",           label: "User",       render: r => <span className="font-mono text-zinc-400 text-[10px]">{trunc(r.user_id, 16)}</span> },
    { key: "endpoint",          label: "Endpoint",   render: r => <Pill label={r.endpoint} color="blue" /> },
    { key: "session_id",        label: "Session",    render: r => <span className="font-mono text-zinc-500 text-[10px]">{trunc(r.session_id, 24)}</span> },
    { key: "prompt_chars",      label: "Chars p/r",  render: r => <span className="font-mono text-zinc-300">{r.prompt_chars} / {r.response_chars}</span> },
    { key: "cost_estimate_inr", label: "Cost ₹",     render: r => <span className="font-mono text-amber-300">{r.cost_estimate_inr != null ? `₹${r.cost_estimate_inr.toFixed(5)}` : "—"}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.endpoint || ""} onChange={e => handleFilter("endpoint", e.target.value)}>
          <option value="">All endpoints</option>
          <option value="crew-suggestions">crew-suggestions</option>
          <option value="gig-checklist">gig-checklist</option>
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function WhatsAppTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/whatsapp");
  const columns = [
    { key: "created_at", label: "Time",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at || r.sent_at)}</span> },
    { key: "user_id",    label: "User",     render: r => <span className="font-mono text-zinc-400 text-[10px]">{trunc(r.user_id || "—", 16)}</span> },
    { key: "phone",      label: "Phone",    render: r => <span className="font-mono text-zinc-300">{r.phone}</span> },
    { key: "type",       label: "Template", render: r => <Pill label={r.type || r.template || "—"} color="blue" /> },
    { key: "status",     label: "Status",   render: r => <Pill label={r.status || (r.simulated ? "simulated" : "—")} color={r.status === "failed" ? "red" : "green"} /> },
    { key: "simulated",  label: "Mode",     render: r => <Pill label={r.simulated ? "mock" : "live"} color={r.simulated ? "zinc" : "green"} /> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select className={selectClass} value={filters.status || ""} onChange={e => handleFilter("status", e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
        </select>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

function LoginAuditTab({ api }) {
  const { items, total, loading, skip, filters, handleSkip, handleFilter, refresh } =
    useLogFetch(api, "/admin/logs/logins");
  const [search, setSearch] = useState("");
  const columns = [
    { key: "created_at",  label: "Time",       render: r => <span className="font-mono text-zinc-400 text-[10px]">{fmt(r.created_at)}</span> },
    { key: "user_id",     label: "User ID",    render: r => <span className="font-mono text-zinc-300 text-[10px]">{trunc(r.user_id, 20)}</span> },
    { key: "ip",          label: "IP Address", render: r => <span className="font-mono text-zinc-300">{r.ip || "—"}</span> },
    { key: "user_agent",  label: "Device",     rawTitle: "user_agent", render: r => <span className="font-mono text-zinc-500 text-[10px]">{trunc(r.user_agent, 45)}</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="bg-zinc-900 border border-white/10 text-zinc-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-blue-500/60 font-mono w-56"
          placeholder="Filter by user ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleFilter("user_id", search)}
        />
        <Button variant="outline" size="sm" onClick={() => handleFilter("user_id", search)}
          className="border-white/10 text-zinc-400 text-xs h-8">
          Search
        </Button>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10 text-zinc-400 text-xs gap-1 ml-auto h-8">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <LogTable columns={columns} rows={items} loading={loading} total={total} skip={skip} onSkipChange={handleSkip} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const Card = ({ children }) => (
  <div className="rounded-xl border p-5 mt-4" style={{ background: "#0F1628", borderColor: "rgba(255,255,255,0.07)" }}>
    {children}
  </div>
);

export default function AdminLogs() {
  const { api } = useAuth();
  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <ScrollText size={20} className="text-blue-400" />
          <div>
            <h1 className="text-xl font-semibold text-white font-display">Logs & Monitoring</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Admin actions, API errors, payments, AI usage, WhatsApp, and login audit
            </p>
          </div>
        </div>

        <Tabs defaultValue="activity">
          <TabsList className="border border-white/5 flex-wrap h-auto gap-0.5" style={{ background: "#0D1220" }}>
            {[
              { value: "activity",   icon: Activity,      label: "Activity" },
              { value: "api-errors", icon: AlertCircle,   label: "API Errors" },
              { value: "payments",   icon: CreditCard,    label: "Payments" },
              { value: "ai-usage",   icon: Cpu,           label: "AI Usage" },
              { value: "whatsapp",   icon: MessageSquare, label: "WhatsApp" },
              { value: "logins",     icon: LogIn,         label: "Login Audit" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value}
                className="data-[state=active]:bg-blue-600/30 data-[state=active]:text-blue-300 font-display text-xs gap-1.5">
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="activity">   <Card><ActivityTab   api={api} /></Card></TabsContent>
          <TabsContent value="api-errors"> <Card><ApiErrorsTab  api={api} /></Card></TabsContent>
          <TabsContent value="payments">   <Card><PaymentsTab   api={api} /></Card></TabsContent>
          <TabsContent value="ai-usage">   <Card><AiUsageTab    api={api} /></Card></TabsContent>
          <TabsContent value="whatsapp">   <Card><WhatsAppTab   api={api} /></Card></TabsContent>
          <TabsContent value="logins">     <Card><LoginAuditTab api={api} /></Card></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Add Logs nav item to `AdminLayout.jsx`**

In `AdminLayout.jsx`, change the `ADMIN_NAV` array from:
```javascript
const ADMIN_NAV = [
  { path: "/admin/dashboard",    icon: LayoutDashboard, label: "Overview" },
  { path: "/admin/verification", icon: ShieldCheck,     label: "Verification" },
  { path: "/admin/users",        icon: Users,           label: "Users" },
  { path: "/admin/penalties",    icon: AlertTriangle,   label: "Penalties" },
  { path: "/admin/gig-board",    icon: Globe,           label: "Gig Board" },
  { path: "/admin/settings",     icon: Settings,        label: "Settings" },
];
```
to:
```javascript
const ADMIN_NAV = [
  { path: "/admin/dashboard",    icon: LayoutDashboard, label: "Overview" },
  { path: "/admin/verification", icon: ShieldCheck,     label: "Verification" },
  { path: "/admin/users",        icon: Users,           label: "Users" },
  { path: "/admin/penalties",    icon: AlertTriangle,   label: "Penalties" },
  { path: "/admin/gig-board",    icon: Globe,           label: "Gig Board" },
  { path: "/admin/logs",         icon: ScrollText,      label: "Logs" },
  { path: "/admin/settings",     icon: Settings,        label: "Settings" },
];
```

Also add `ScrollText` to the lucide import at the top of `AdminLayout.jsx`:
```javascript
import {
  LayoutDashboard, ShieldCheck, Users, AlertTriangle,
  LogOut, ChevronLeft, ChevronRight, Menu, X, Shield, Globe, Settings, ScrollText
} from "lucide-react";
```

- [ ] **Step 3: Add route in `App.js`**

Add import after the `AdminSettings` import:
```javascript
import AdminLogs from "@/pages/admin/AdminLogs";
```

In `AdminRoutes`, add before the catch-all `admin/*` route:
```jsx
      <Route path="/admin/logs" element={<AdminGuard><AdminLogs /></AdminGuard>} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminLogs.jsx \
        frontend/src/components/AdminLayout.jsx \
        frontend/src/App.js
git commit -m "feat: add AdminLogs page with 6-tab log viewer and nav entry"
```

---

## Task 9: Integration Tests

**Files:**
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Add `TestLogs` class to `test_crewbook.py`**

Append after the last test class:

```python
class TestLogs:
    """Logs & Monitoring endpoint tests"""

    def test_admin_action_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/admin-actions")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_admin_action_logs_with_filter(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/admin-actions?action=verify_user")
        assert resp.status_code == 200
        data = resp.json()
        for item in data["items"]:
            assert item["action"] == "verify_user"

    def test_api_error_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/api-errors")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data

    def test_api_error_logs_filter_status_code(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/api-errors?status_code=404")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status_code"] == 404

    def test_payment_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/payments")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data

    def test_payment_logs_filter_event(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/payments?event=order_created")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["event"] == "order_created"

    def test_ai_usage_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/ai-usage")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data

    def test_whatsapp_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/whatsapp")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data

    def test_login_logs_endpoint(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/logins")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data and "total" in data
        # There should be at least one login log from admin_token fixture
        assert data["total"] >= 1

    def test_login_logs_filter_user_id(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.get(f"{BASE_URL}/api/admin/logs/logins?user_id={user_id}")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["user_id"] == user_id

    def test_admin_logs_requires_auth(self, api):
        """Log endpoints must reject unauthenticated requests."""
        s = requests.Session()
        for path in [
            "/api/admin/logs/admin-actions",
            "/api/admin/logs/api-errors",
            "/api/admin/logs/payments",
            "/api/admin/logs/ai-usage",
            "/api/admin/logs/whatsapp",
            "/api/admin/logs/logins",
        ]:
            resp = s.get(f"{BASE_URL}{path}")
            assert resp.status_code in (401, 403), f"{path} should require auth"

    def test_verify_action_creates_admin_log(self, admin_client, registered_user):
        """Verifying a user should write an admin_log entry."""
        user_id = registered_user["user"]["id"]
        admin_client.put(
            f"{BASE_URL}/api/admin/verify/{user_id}",
            json={"action": "approved"},
        )
        resp = admin_client.get(
            f"{BASE_URL}/api/admin/logs/admin-actions?action=verify_user&limit=10"
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert any(item["target_id"] == user_id for item in items)
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && pytest tests/test_crewbook.py::TestLogs -v
```

Expected: all tests pass. If a test fails due to timing (log not yet written), verify the route actually calls `log_admin_action` and that the `await` is not missing.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_crewbook.py
git commit -m "test: add TestLogs integration tests for all six log endpoints"
```
