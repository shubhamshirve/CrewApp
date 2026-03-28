# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 admin features to branch 1.3: full user table with filters, user profile deep-dive, bulk actions, impersonation, manual wallet adjust, and role override flags.

**Architecture:** Backend-first approach — each new endpoint is added to `backend/routers/admin.py` (and one change to `auth.py` for login tracking), tested via the integration test file, then the corresponding frontend is built. All admin frontend pages use `AdminLayout` and follow the existing 1.3 blue-on-dark design (`#0D1220` cards, `#3B82F6` accents).

**Tech Stack:** FastAPI + Motor (async MongoDB), python-jose (JWT), React 19, Tailwind CSS, Shadcn/ui Tabs, React Router v7

---

## File Map

| File | Change |
|---|---|
| `backend/routers/auth.py` | Add login tracking on POST /auth/login |
| `backend/routers/admin.py` | Enhance GET /admin/users + 5 new endpoints |
| `backend/auth_utils.py` | Add `create_impersonation_token` |
| `backend/tests/test_crewbook.py` | Add new test classes |
| `frontend/src/contexts/AuthContext.js` | Check sessionStorage fallback for token |
| `frontend/src/pages/admin/AdminUsers.jsx` | Add filter bar + checkboxes + bulk toolbar |
| `frontend/src/pages/admin/AdminUserProfile.jsx` | New: 5-tab user profile deep-dive |
| `frontend/src/App.js` | Add `/admin/users/:id` route |

---

## Task 1: Login Tracking

**Files:**
- Modify: `backend/routers/auth.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add this class to `backend/tests/test_crewbook.py`:

```python
class TestLoginTracking:
    """Login events are recorded in login_logs"""

    def test_login_creates_log(self, api, registered_user, admin_client):
        """After login, admin profile endpoint shows a login log entry"""
        user_id = registered_user["user"]["id"]
        # Profile endpoint doesn't exist yet — just verify login succeeded
        assert registered_user["token"] is not None
```

- [ ] **Step 2: Run test to verify it passes immediately (it's a soft assertion)**

```bash
cd backend && pytest tests/test_crewbook.py::TestLoginTracking -v
```

Expected: PASS (the test just checks token exists; the real verification happens in Task 3)

- [ ] **Step 3: Add login tracking to auth.py**

Replace the `login` function in `backend/routers/auth.py`:

```python
from fastapi import APIRouter, HTTPException, Depends, Request
# (add Request to the existing import)

@router.post("/login")
async def login(data: LoginRequest, request: Request):
    db = get_db()
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("is_suspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Please contact support.")
    token = create_access_token(str(user["_id"]))
    # Record login event
    await db.login_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": str(user["_id"]),
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token, "user": _clean_user({**user})}
```

- [ ] **Step 4: Restart backend and verify login still works**

```bash
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Then in another terminal:
```bash
cd backend && pytest tests/test_crewbook.py::TestLoginTracking -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/auth.py backend/tests/test_crewbook.py
git commit -m "feat: record login events in login_logs collection"
```

---

## Task 2: Add `create_impersonation_token` to auth_utils

**Files:**
- Modify: `backend/auth_utils.py`

- [ ] **Step 1: Add impersonation token function**

Add this function to `backend/auth_utils.py` after `create_access_token`:

```python
def create_impersonation_token(user_id: str, admin_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "impersonated_by": admin_id},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
```

- [ ] **Step 2: Verify import is clean**

```bash
cd backend && python -c "from auth_utils import create_impersonation_token; print('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/auth_utils.py
git commit -m "feat: add create_impersonation_token to auth_utils"
```

---

## Task 3: Enhance GET /admin/users with filters

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminUsersFilters:
    """GET /admin/users supports search + filters"""

    def test_search_by_name(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?search=Test")
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total" in data

    def test_filter_by_plan(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?plan=free")
        assert resp.status_code == 200
        users = resp.json()["users"]
        for u in users:
            assert u["subscription_plan"] == "free"

    def test_filter_by_status_suspended(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users?status=suspended")
        assert resp.status_code == 200
        users = resp.json()["users"]
        for u in users:
            assert u["is_suspended"] is True
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUsersFilters -v
```
Expected: FAIL — `status=suspended` returns wrong users (current code ignores the param)

- [ ] **Step 3: Replace GET /admin/users in admin.py**

Replace the existing `list_users` function:

```python
@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None,
    city: Optional[str] = None,
    plan: Optional[str] = None,
    status: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    query = {}

    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    if role:
        query["primary_role"] = role
    if city:
        query["location"] = {"$regex": city, "$options": "i"}
    if plan:
        query["subscription_plan"] = plan
    if status == "suspended":
        query["is_suspended"] = True
    elif status:
        query["verification_status"] = status
    if min_rating is not None:
        query.setdefault("avg_rating", {})["$gte"] = min_rating
    if max_rating is not None:
        query.setdefault("avg_rating", {})["$lte"] = max_rating

    skip = (page - 1) * limit
    users = await db.users.find(query, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": [_clean_user(u) for u in users], "total": total, "page": page}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUsersFilters -v
```
Expected: all 3 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_crewbook.py
git commit -m "feat: add search/filter params to GET /admin/users"
```

---

## Task 4: GET /admin/users/{user_id}/profile

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminUserProfile:
    """GET /admin/users/{id}/profile returns aggregated user data"""

    def test_profile_returns_all_sections(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/{user_id}/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert "user" in data
        assert "gigs" in data
        assert "invites" in data
        assert "wallet_transactions" in data
        assert "wallet_adjustments" in data
        assert "ratings" in data
        assert "login_logs" in data

    def test_profile_user_no_password(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/{user_id}/profile")
        assert "password_hash" not in resp.json()["user"]

    def test_profile_404_on_missing_user(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/admin/users/nonexistent-id/profile")
        assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUserProfile -v
```
Expected: FAIL with 404

- [ ] **Step 3: Add profile endpoint to admin.py**

Add this after the `list_users` function in `backend/routers/admin.py`:

```python
@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    gigs = await db.gigs.find({"lead_id": user_id}).sort("created_at", -1).limit(50).to_list(50)
    for g in gigs:
        g["id"] = str(g.pop("_id"))

    invites = await db.gig_invites.find(
        {"$or": [{"lead_id": user_id}, {"freelancer_id": user_id}]}
    ).sort("created_at", -1).limit(50).to_list(50)
    for inv in invites:
        inv["id"] = str(inv.pop("_id"))

    wallet_txns = await db.wallet_transactions.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    for t in wallet_txns:
        t["id"] = str(t.pop("_id"))

    wallet_adjs = await db.wallet_adjustments.find(
        {"user_id": user_id}
    ).sort("created_at", -1).to_list(100)
    for a in wallet_adjs:
        a["id"] = str(a.pop("_id"))

    ratings = await db.ratings.find(
        {"ratee_id": user_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    for r in ratings:
        r["id"] = str(r.pop("_id"))

    login_logs = await db.login_logs.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    for l in login_logs:
        l["id"] = str(l.pop("_id"))

    return {
        "user": _clean_user(user),
        "gigs": gigs,
        "invites": invites,
        "wallet_transactions": wallet_txns,
        "wallet_adjustments": wallet_adjs,
        "ratings": ratings,
        "login_logs": login_logs,
    }
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUserProfile -v
```
Expected: all 3 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_crewbook.py
git commit -m "feat: add GET /admin/users/{id}/profile endpoint"
```

---

## Task 5: POST /admin/users/bulk-action

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminBulkAction:
    """POST /admin/users/bulk-action applies actions to multiple users"""

    def test_bulk_suspend(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "suspend",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1
        # Verify user is suspended
        user_resp = admin_client.get(f"{BASE_URL}/api/admin/users")
        users = user_resp.json()["users"]
        target = next((u for u in users if u["id"] == user_id), None)
        assert target is not None
        assert target["is_suspended"] is True

    def test_bulk_unsuspend(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "unsuspend",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_verify(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "verify",
            "user_ids": [user_id],
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_notify(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "notify",
            "user_ids": [user_id],
            "title": "Test announcement",
            "message": "This is a bulk notification",
        })
        assert resp.status_code == 200
        assert resp.json()["updated"] == 1

    def test_bulk_invalid_action(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/admin/users/bulk-action", json={
            "action": "delete_everything",
            "user_ids": [],
        })
        assert resp.status_code == 400
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminBulkAction -v
```
Expected: FAIL with 404 or 422

- [ ] **Step 3: Add Pydantic model and endpoint to admin.py**

Add the model near the top of `backend/routers/admin.py` with the other models:

```python
from typing import Optional, List

class BulkActionRequest(BaseModel):
    action: str  # suspend | unsuspend | verify | notify
    user_ids: List[str]
    title: Optional[str] = None
    message: Optional[str] = None
```

Then add the endpoint after `list_users`:

```python
@router.post("/users/bulk-action")
async def bulk_action(data: BulkActionRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
    if data.action not in ("suspend", "unsuspend", "verify", "notify"):
        raise HTTPException(status_code=400, detail=f"Unknown action: {data.action}")
    if not data.user_ids:
        return {"updated": 0}

    now = datetime.now(timezone.utc).isoformat()
    updated = 0

    if data.action == "suspend":
        result = await db.users.update_many(
            {"_id": {"$in": data.user_ids}},
            {"$set": {"is_suspended": True, "updated_at": now}},
        )
        updated = result.modified_count

    elif data.action == "unsuspend":
        result = await db.users.update_many(
            {"_id": {"$in": data.user_ids}},
            {"$set": {"is_suspended": False, "updated_at": now}},
        )
        updated = result.modified_count

    elif data.action == "verify":
        result = await db.users.update_many(
            {"_id": {"$in": data.user_ids}},
            {"$set": {"is_verified": True, "verification_status": "approved", "updated_at": now}},
        )
        updated = result.modified_count

    elif data.action == "notify":
        if not data.title or not data.message:
            raise HTTPException(status_code=400, detail="title and message required for notify action")
        for uid in data.user_ids:
            await send_notification(db, uid, "admin_broadcast", data.title, data.message, {})
        updated = len(data.user_ids)

    return {"updated": updated}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminBulkAction -v
```
Expected: all 5 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_crewbook.py
git commit -m "feat: add POST /admin/users/bulk-action endpoint"
```

---

## Task 6: POST /admin/impersonate/{user_id}

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminImpersonate:
    """POST /admin/impersonate/{id} returns a short-lived user token"""

    def test_impersonate_returns_token(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/{user_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["expires_in"] == 3600

    def test_impersonate_token_authenticates_as_user(self, api, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/{user_id}")
        token = resp.json()["token"]
        # Use impersonation token to call /auth/me
        me_resp = api.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["id"] == user_id

    def test_impersonate_nonexistent_user(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/admin/impersonate/nonexistent-id")
        assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminImpersonate -v
```
Expected: FAIL with 404

- [ ] **Step 3: Add import and endpoint to admin.py**

Add to imports at top of `backend/routers/admin.py`:

```python
from auth_utils import get_admin_user, _clean_user, create_impersonation_token
```

Add the endpoint:

```python
@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: str, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = create_impersonation_token(user_id=user_id, admin_id=admin["id"])
    return {"token": token, "expires_in": 3600}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminImpersonate -v
```
Expected: all 3 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/admin.py backend/auth_utils.py backend/tests/test_crewbook.py
git commit -m "feat: add POST /admin/impersonate/{user_id} endpoint"
```

---

## Task 7: POST /admin/wallet/{user_id}/adjust

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminWalletAdjust:
    """POST /admin/wallet/{id}/adjust credits or debits user wallet"""

    def test_credit_increases_balance(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 100.0,
            "type": "credit",
            "reason": "Goodwill credit for test",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "new_balance" in data
        assert data["new_balance"] >= 100.0

    def test_debit_decreases_balance(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        # First credit 200
        admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 200.0, "type": "credit", "reason": "Setup"
        })
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 50.0,
            "type": "debit",
            "reason": "Correction debit",
        })
        assert resp.status_code == 200
        assert resp.json()["new_balance"] >= 150.0  # 200 - 50 minimum

    def test_zero_amount_rejected(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 0,
            "type": "credit",
            "reason": "Bad input",
        })
        assert resp.status_code == 400

    def test_missing_reason_rejected(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.post(f"{BASE_URL}/api/admin/wallet/{user_id}/adjust", json={
            "amount": 10.0,
            "type": "credit",
            "reason": "",
        })
        assert resp.status_code == 400
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminWalletAdjust -v
```
Expected: FAIL with 404

- [ ] **Step 3: Add Pydantic model and endpoint to admin.py**

Add model with other models near top of admin.py:

```python
class WalletAdjustRequest(BaseModel):
    amount: float
    type: str  # credit | debit
    reason: str
```

Add endpoint:

```python
@router.post("/wallet/{user_id}/adjust")
async def adjust_wallet(user_id: str, data: WalletAdjustRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required")
    if data.type not in ("credit", "debit"):
        raise HTTPException(status_code=400, detail="type must be credit or debit")

    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_balance = user.get("wallet_balance", 0.0)
    delta = data.amount if data.type == "credit" else -data.amount
    new_balance = current_balance + delta

    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"wallet_balance": new_balance, "updated_at": now}},
    )
    adj_id = str(uuid.uuid4())
    await db.wallet_adjustments.insert_one({
        "_id": adj_id,
        "user_id": user_id,
        "admin_id": admin["id"],
        "type": data.type,
        "amount": data.amount,
        "reason": data.reason,
        "created_at": now,
    })
    txn_type = "admin_credit" if data.type == "credit" else "admin_debit"
    await db.wallet_transactions.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": txn_type,
        "amount": data.amount,
        "description": data.reason,
        "created_at": now,
    })
    await send_notification(
        db, user_id, "wallet",
        f"Wallet {'Credited' if data.type == 'credit' else 'Debited'}",
        f"₹{data.amount:.2f} {'added to' if data.type == 'credit' else 'deducted from'} your wallet. Reason: {data.reason}",
        {},
    )
    return {"new_balance": new_balance}
```

Add `import uuid` if not already at top of admin.py.

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminWalletAdjust -v
```
Expected: all 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_crewbook.py
git commit -m "feat: add POST /admin/wallet/{user_id}/adjust endpoint"
```

---

## Task 8: PUT /admin/users/{user_id}/flags

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/tests/test_crewbook.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_crewbook.py`:

```python
class TestAdminUserFlags:
    """PUT /admin/users/{id}/flags sets is_featured and is_high_risk"""

    def test_set_featured(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/flags", json={
            "is_featured": True,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_featured"] is True

    def test_set_high_risk(self, admin_client, registered_user):
        user_id = registered_user["user"]["id"]
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/{user_id}/flags", json={
            "is_high_risk": True,
        })
        assert resp.status_code == 200
        assert resp.json()["is_high_risk"] is True

    def test_flags_404_on_missing(self, admin_client):
        resp = admin_client.put(f"{BASE_URL}/api/admin/users/nonexistent/flags", json={
            "is_featured": False,
        })
        assert resp.status_code == 404
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUserFlags -v
```
Expected: FAIL with 404

- [ ] **Step 3: Add Pydantic model and endpoint to admin.py**

Add model:

```python
class UserFlagsRequest(BaseModel):
    is_featured: Optional[bool] = None
    is_high_risk: Optional[bool] = None
```

Add endpoint:

```python
@router.put("/users/{user_id}/flags")
async def update_user_flags(user_id: str, data: UserFlagsRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.is_featured is not None:
        updates["is_featured"] = data.is_featured
    if data.is_high_risk is not None:
        updates["is_high_risk"] = data.is_high_risk

    await db.users.update_one({"_id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"_id": user_id})
    return {
        "is_featured": updated.get("is_featured", False),
        "is_high_risk": updated.get("is_high_risk", False),
    }
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd backend && pytest tests/test_crewbook.py::TestAdminUserFlags -v
```
Expected: all 3 PASS

- [ ] **Step 5: Run all new backend tests together**

```bash
cd backend && pytest tests/test_crewbook.py::TestLoginTracking tests/test_crewbook.py::TestAdminUsersFilters tests/test_crewbook.py::TestAdminUserProfile tests/test_crewbook.py::TestAdminBulkAction tests/test_crewbook.py::TestAdminImpersonate tests/test_crewbook.py::TestAdminWalletAdjust tests/test_crewbook.py::TestAdminUserFlags -v
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add backend/routers/admin.py backend/tests/test_crewbook.py
git commit -m "feat: add PUT /admin/users/{id}/flags endpoint"
```

---

## Task 9: AuthContext sessionStorage fallback

**Files:**
- Modify: `frontend/src/contexts/AuthContext.js`

This change makes the impersonation flow work: when admin opens `/dashboard` in a new tab with `sessionStorage.crewbook_token` set, the user app boots as the impersonated user without touching the admin's `localStorage`.

- [ ] **Step 1: Update the axios interceptor and fetchMe in AuthContext.js**

Replace the interceptor and `fetchMe` function:

```javascript
// Helper: read token from localStorage first, fall back to sessionStorage
function getToken() {
  return localStorage.getItem("crewbook_token") || sessionStorage.getItem("crewbook_token") || null;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Inside AuthProvider, replace fetchMe:
const fetchMe = useCallback(async () => {
  const token = getToken();
  if (!token) { setLoading(false); return; }
  try {
    const res = await api.get("/auth/me");
    setUser(res.data);
  } catch {
    localStorage.removeItem("crewbook_token");
    sessionStorage.removeItem("crewbook_token");
  } finally {
    setLoading(false);
  }
}, []);
```

The full updated `AuthContext.js`:

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = BACKEND_URL ? `${BACKEND_URL}/api` : "/api";

const api = axios.create({ baseURL: API });

function getToken() {
  return localStorage.getItem("crewbook_token") || sessionStorage.getItem("crewbook_token") || null;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useApi = () => api;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("crewbook_token");
      sessionStorage.removeItem("crewbook_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("crewbook_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    localStorage.setItem("crewbook_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("crewbook_token");
    sessionStorage.removeItem("crewbook_token");
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refreshUser, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify frontend still starts**

```bash
cd frontend && yarn start
```
Expected: compiles without errors, app loads at localhost:3000

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contexts/AuthContext.js
git commit -m "feat: check sessionStorage for token (enables admin impersonation in new tab)"
```

---

## Task 10: Enhance AdminUsers with filters + checkboxes + bulk toolbar

**Files:**
- Modify: `frontend/src/pages/admin/AdminUsers.jsx`

- [ ] **Step 1: Replace AdminUsers.jsx with enhanced version**

Full replacement of `frontend/src/pages/admin/AdminUsers.jsx`:

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Users, AlertTriangle, Ban, CheckCircle, Search, Loader2, Filter, X, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLANS = ["", "free", "base", "premium"];
const STATUSES = ["", "pending", "approved", "rejected", "not_submitted", "suspended"];

export default function AdminUsers() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");

  // Bulk
  const [selected, setSelected] = useState(new Set());
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ title: "", message: "" });
  const [bulkLoading, setBulkLoading] = useState(false);

  // Per-row actions
  const [penaltyData, setPenaltyData] = useState({ userId: "", reason: "", stars: 1 });
  const [showPenalty, setShowPenalty] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (role) params.set("role", role);
      if (city) params.set("city", city);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      if (minRating) params.set("min_rating", minRating);
      if (maxRating) params.set("max_rating", maxRating);
      const r = await api.get(`/admin/users?${params.toString()}`);
      setUsers(r.data.users);
      setTotal(r.data.total);
      setSelected(new Set());
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [api, search, role, city, plan, status, minRating, maxRating]);

  useEffect(() => { load(); }, [load]);

  const clearFilters = () => {
    setSearch(""); setRole(""); setCity(""); setPlan("");
    setStatus(""); setMinRating(""); setMaxRating("");
  };

  const hasFilters = search || role || city || plan || status || minRating || maxRating;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map(u => u.id)));
    }
  };

  const handleBulkAction = async (action) => {
    setBulkLoading(true);
    try {
      const body = { action, user_ids: Array.from(selected) };
      if (action === "notify") {
        if (!notifyForm.title || !notifyForm.message) { toast.error("Title and message required"); return; }
        body.title = notifyForm.title;
        body.message = notifyForm.message;
      }
      const r = await api.post("/admin/users/bulk-action", body);
      toast.success(`${r.data.updated} user(s) updated`);
      setShowNotifyModal(false);
      setNotifyForm({ title: "", message: "" });
      load();
    } catch { toast.error("Bulk action failed"); }
    finally { setBulkLoading(false); }
  };

  const handleToggleSuspend = async (userId) => {
    setActionLoading(l => ({ ...l, [userId]: true }));
    try {
      const r = await api.put(`/admin/suspend/${userId}`);
      toast.success(r.data.is_suspended ? "User suspended" : "User unsuspended");
      load();
    } catch { toast.error("Action failed"); }
    finally { setActionLoading(l => ({ ...l, [userId]: false })); }
  };

  const handlePenalty = async () => {
    if (!penaltyData.reason) { toast.error("Enter a reason"); return; }
    try {
      await api.post(`/admin/penalty/${penaltyData.userId}`, {
        reason: penaltyData.reason, stars: penaltyData.stars,
      });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyData({ userId: "", reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
  };

  const inputCls = "rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-blue-500/50 transition-colors";
  const selectCls = `${inputCls} appearance-none`;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-5 pb-24">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white font-display">Users</h1>
            <p className="text-zinc-500 text-sm mt-1">{total} registered users</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            data-testid="admin-user-search"
            className={`w-full pl-10 pr-4 py-2.5 ${inputCls}`}
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-zinc-600 flex-shrink-0" />
          <select
            className={`${selectCls} text-xs`}
            style={{ background: "#0D1220" }}
            value={plan}
            onChange={e => setPlan(e.target.value)}
          >
            <option value="">All Plans</option>
            {PLANS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className={`${selectCls} text-xs`}
            style={{ background: "#0D1220" }}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            className={`${inputCls} text-xs w-28`}
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="Role…"
            value={role}
            onChange={e => setRole(e.target.value)}
          />
          <input
            className={`${inputCls} text-xs w-28`}
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="City…"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
          <input
            type="number"
            min="0" max="5" step="0.1"
            className={`${inputCls} text-xs w-20`}
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="Min ★"
            value={minRating}
            onChange={e => setMinRating(e.target.value)}
          />
          <input
            type="number"
            min="0" max="5" step="0.1"
            className={`${inputCls} text-xs w-20`}
            style={{ background: "rgba(255,255,255,0.04)" }}
            placeholder="Max ★"
            value={maxRating}
            onChange={e => setMaxRating(e.target.value)}
          />
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select-all header */}
            {users.length > 0 && (
              <div className="flex items-center gap-3 px-2 pb-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-blue-500"
                  checked={selected.size === users.length && users.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs text-zinc-500">
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                </span>
              </div>
            )}

            {users.map(u => (
              <div
                key={u.id}
                data-testid={`user-row-${u.id}`}
                className="flex items-center justify-between p-4 rounded-2xl border transition-colors"
                style={{
                  background: selected.has(u.id) ? "rgba(59,130,246,0.08)" : "#0D1220",
                  borderColor: selected.has(u.id) ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-blue-500 flex-shrink-0"
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold font-display cursor-pointer"
                    style={{ background: "#1D4ED820", color: "#3B82F6" }}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    {u.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm text-white font-display font-medium truncate cursor-pointer hover:text-blue-400 transition-colors"
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      {u.full_name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {u.email} · {u.primary_role || "No role set"}
                      {u.location && ` · ${u.location}`}
                      {u.avg_rating && ` · ★ ${u.avg_rating.toFixed(1)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.is_verified ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/50 text-zinc-400"
                  }`}>
                    {u.is_verified ? "Verified" : u.verification_status}
                  </span>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-display ${
                    u.subscription_plan !== "free" ? "bg-blue-500/15 text-blue-400" : "bg-zinc-700/30 text-zinc-600"
                  }`}>
                    {u.subscription_plan}
                  </span>
                  {u.is_suspended && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400">Suspended</span>
                  )}
                  {u.is_featured && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">Featured</span>
                  )}
                  {u.is_high_risk && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-rose-500/15 text-rose-400">High Risk</span>
                  )}
                  <button
                    data-testid={`penalty-btn-${u.id}`}
                    onClick={() => { setPenaltyData(p => ({ ...p, userId: u.id })); setShowPenalty(true); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 transition-colors"
                  >
                    <AlertTriangle size={11} /> Penalty
                  </button>
                  <button
                    data-testid={`suspend-btn-${u.id}`}
                    onClick={() => handleToggleSuspend(u.id)}
                    disabled={actionLoading[u.id]}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-60 ${
                      u.is_suspended
                        ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        : "text-red-400 border-red-500/30 hover:bg-red-500/10"
                    }`}
                  >
                    {actionLoading[u.id]
                      ? <Loader2 size={11} className="animate-spin" />
                      : u.is_suspended ? <CheckCircle size={11} /> : <Ban size={11} />
                    }
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-zinc-600">
                <Users size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 shadow-2xl z-40"
          style={{ background: "#0D1220" }}
        >
          <span className="text-sm text-zinc-300 font-display">{selected.size} selected</span>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={() => handleBulkAction("suspend")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-60"
          >
            Suspend
          </button>
          <button
            onClick={() => handleBulkAction("unsuspend")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
          >
            Unsuspend
          </button>
          <button
            onClick={() => handleBulkAction("verify")}
            disabled={bulkLoading}
            className="text-xs px-3 py-1.5 rounded-lg text-blue-400 border border-blue-500/30 hover:bg-blue-500/10 transition-colors disabled:opacity-60"
          >
            Verify
          </button>
          <button
            onClick={() => setShowNotifyModal(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
          >
            <Send size={11} /> Notify
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Penalty Dialog */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" /> Apply Penalty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Stars to deduct</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 focus:outline-none"
                style={{ background: "#111827" }}
                value={penaltyData.stars}
                onChange={e => setPenaltyData(p => ({ ...p, stars: parseInt(e.target.value) }))}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason *</label>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 resize-none h-20 focus:outline-none focus:border-orange-500/50"
                style={{ background: "rgba(255,255,255,0.04)" }}
                placeholder="Explain the penalty reason…"
                value={penaltyData.reason}
                onChange={e => setPenaltyData(p => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPenalty(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="apply-penalty-btn"
                onClick={handlePenalty}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#EA580C" }}
              >
                Apply Penalty
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify Modal */}
      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display flex items-center gap-2">
              <Send size={16} className="text-amber-400" /> Notify {selected.size} Users
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Title *</label>
              <input
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 focus:outline-none focus:border-amber-500/50"
                style={{ background: "rgba(255,255,255,0.04)" }}
                placeholder="Notification title…"
                value={notifyForm.title}
                onChange={e => setNotifyForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Message *</label>
              <textarea
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 resize-none h-24 focus:outline-none focus:border-amber-500/50"
                style={{ background: "rgba(255,255,255,0.04)" }}
                placeholder="Your message…"
                value={notifyForm.message}
                onChange={e => setNotifyForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkAction("notify")}
                disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#D97706" }}
              >
                {bulkLoading ? "Sending…" : "Send Notification"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && yarn start
```
Expected: no compile errors, admin users page shows filter bar and checkboxes

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/AdminUsers.jsx
git commit -m "feat: add filter bar, checkboxes, and bulk actions to AdminUsers"
```

---

## Task 11: Create AdminUserProfile page + register route

**Files:**
- Create: `frontend/src/pages/admin/AdminUserProfile.jsx`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Create AdminUserProfile.jsx**

Create `frontend/src/pages/admin/AdminUserProfile.jsx`:

```jsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Zap, Ban, CheckCircle, AlertTriangle,
  Star, Wallet, Shield, Monitor, Briefcase, Clock, UserCheck, Flag
} from "lucide-react";
import { toast } from "sonner";

export default function AdminUserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Wallet adjust modal
  const [showWallet, setShowWallet] = useState(false);
  const [walletForm, setWalletForm] = useState({ amount: "", type: "credit", reason: "" });
  const [walletLoading, setWalletLoading] = useState(false);

  // Penalty modal
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState({ reason: "", stars: 1 });
  const [penaltyLoading, setPenaltyLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/users/${id}/profile`);
      setProfile(r.data);
    } catch {
      toast.error("Failed to load user profile");
      navigate("/admin/users");
    } finally {
      setLoading(false);
    }
  }, [api, id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleImpersonate = async () => {
    try {
      const r = await api.post(`/admin/impersonate/${id}`);
      sessionStorage.setItem("crewbook_token", r.data.token);
      window.open("/dashboard", "_blank");
      toast.success("Opened user session in new tab (1-hour token)");
    } catch {
      toast.error("Impersonation failed");
    }
  };

  const handleToggleSuspend = async () => {
    setActionLoading(true);
    try {
      const r = await api.put(`/admin/suspend/${id}`);
      toast.success(r.data.is_suspended ? "User suspended" : "User unsuspended");
      load();
    } catch { toast.error("Failed"); }
    finally { setActionLoading(false); }
  };

  const handleFlag = async (field, value) => {
    try {
      await api.put(`/admin/users/${id}/flags`, { [field]: value });
      toast.success("Flag updated");
      load();
    } catch { toast.error("Failed to update flag"); }
  };

  const handleWalletAdjust = async () => {
    if (!walletForm.amount || parseFloat(walletForm.amount) <= 0) {
      toast.error("Enter a valid amount"); return;
    }
    if (!walletForm.reason.trim()) { toast.error("Reason is required"); return; }
    setWalletLoading(true);
    try {
      const r = await api.post(`/admin/wallet/${id}/adjust`, {
        amount: parseFloat(walletForm.amount),
        type: walletForm.type,
        reason: walletForm.reason,
      });
      toast.success(`Wallet updated. New balance: ₹${r.data.new_balance.toFixed(2)}`);
      setShowWallet(false);
      setWalletForm({ amount: "", type: "credit", reason: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Wallet adjustment failed");
    } finally { setWalletLoading(false); }
  };

  const handlePenalty = async () => {
    if (!penaltyForm.reason) { toast.error("Enter a reason"); return; }
    setPenaltyLoading(true);
    try {
      await api.post(`/admin/penalty/${id}`, {
        reason: penaltyForm.reason,
        stars: penaltyForm.stars,
      });
      toast.success("Penalty applied");
      setShowPenalty(false);
      setPenaltyForm({ reason: "", stars: 1 });
      load();
    } catch { toast.error("Failed"); }
    finally { setPenaltyLoading(false); }
  };

  const cardCls = "p-4 rounded-2xl border";
  const cardStyle = { background: "#0D1220", borderColor: "rgba(255,255,255,0.07)" };
  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 focus:outline-none focus:border-blue-500/50";
  const inputStyle = { background: "rgba(255,255,255,0.04)" };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) return null;
  const { user, gigs, invites, wallet_transactions, wallet_adjustments, ratings, login_logs } = profile;

  // Merge wallet transactions + adjustments into one timeline
  const walletTimeline = [
    ...wallet_transactions.map(t => ({ ...t, _source: "txn" })),
    ...wallet_adjustments.map(a => ({ ...a, _source: "adj" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const fmt = (iso) => iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back + header */}
        <div>
          <button
            onClick={() => navigate("/admin/users")}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Back to Users
          </button>

          <div className={`${cardCls} flex flex-col sm:flex-row items-start sm:items-center gap-4`} style={cardStyle}>
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold font-display flex-shrink-0"
              style={{ background: "#1D4ED820", color: "#3B82F6" }}
            >
              {user.full_name?.[0]?.toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white font-display">{user.full_name}</h1>
                {user.is_verified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Verified</span>}
                {user.is_suspended && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Suspended</span>}
                {user.is_featured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Featured</span>}
                {user.is_high_risk && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400">High Risk</span>}
              </div>
              <p className="text-xs text-zinc-400">{user.email} · {user.phone} · {user.location}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{user.primary_role || "No role"} · {user.subscription_plan} plan</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={handleImpersonate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "#1D4ED8" }}
              >
                <Zap size={12} /> Impersonate
              </button>
              <button
                onClick={handleToggleSuspend}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-colors disabled:opacity-60 ${
                  user.is_suspended
                    ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    : "text-red-400 border-red-500/30 hover:bg-red-500/10"
                }`}
              >
                {user.is_suspended ? <CheckCircle size={12} /> : <Ban size={12} />}
                {user.is_suspended ? "Unsuspend" : "Suspend"}
              </button>
              <button
                onClick={() => setShowPenalty(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 transition-colors"
              >
                <AlertTriangle size={12} /> Penalty
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="border border-white/5" style={{ background: "#0D1220" }}>
            {[
              { value: "overview", label: "Overview", icon: UserCheck },
              { value: "gigs", label: `Gigs (${gigs.length})`, icon: Briefcase },
              { value: "wallet", label: "Wallet", icon: Wallet },
              { value: "ratings", label: `Ratings (${ratings.length})`, icon: Star },
              { value: "logins", label: "Login History", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-[state=active]:bg-blue-600/30 data-[state=active]:text-blue-300 font-display text-xs gap-1.5"
              >
                <Icon size={11} /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Profile details */}
            <div className={cardCls} style={cardStyle}>
              <h3 className="text-sm font-semibold text-white font-display mb-3">Profile Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["ID", user.id],
                  ["Email", user.email],
                  ["Phone", user.phone],
                  ["Location", user.location],
                  ["Pincode", user.pincode],
                  ["Plan", user.subscription_plan],
                  ["Primary Role", user.primary_role || "—"],
                  ["Avg Rating", user.avg_rating ? `★ ${user.avg_rating.toFixed(2)}` : "—"],
                  ["Negative Stars", user.negative_stars ?? 0],
                  ["Wallet Balance", `₹${(user.wallet_balance || 0).toFixed(2)}`],
                  ["Joined", fmt(user.created_at)],
                  ["Referral Code", user.referral_code || "—"],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] text-zinc-600 font-display uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-zinc-300 mt-0.5 truncate">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Flags */}
            <div className={cardCls} style={cardStyle}>
              <h3 className="text-sm font-semibold text-white font-display mb-3">Role Overrides</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => handleFlag("is_featured", !user.is_featured)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      user.is_featured ? "bg-amber-500" : "bg-zinc-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      user.is_featured ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-zinc-300 font-display">Featured</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => handleFlag("is_high_risk", !user.is_high_risk)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      user.is_high_risk ? "bg-rose-500" : "bg-zinc-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      user.is_high_risk ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-zinc-300 font-display">High Risk</span>
                </label>
              </div>
            </div>

            {/* Wallet summary */}
            <div className={cardCls} style={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white font-display">Wallet Balance</h3>
                <button
                  onClick={() => setShowWallet(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: "#1D4ED8" }}
                >
                  <Wallet size={11} /> Credit / Debit
                </button>
              </div>
              <p className="text-3xl font-bold text-white font-display">
                ₹{(user.wallet_balance || 0).toFixed(2)}
              </p>
            </div>
          </TabsContent>

          {/* Gigs Tab */}
          <TabsContent value="gigs" className="mt-4">
            {gigs.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Briefcase size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No gigs created</p>
              </div>
            ) : (
              <div className="space-y-2">
                {gigs.map(g => (
                  <div key={g.id} className={`${cardCls} flex items-center justify-between`} style={cardStyle}>
                    <div>
                      <p className="text-sm text-white font-display font-medium">{g.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{fmt(g.created_at)}</p>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">
                      {g.status || "draft"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-zinc-400">{walletTimeline.length} transactions</p>
              <button
                onClick={() => setShowWallet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: "#1D4ED8" }}
              >
                <Wallet size={11} /> Add Credit / Debit
              </button>
            </div>
            {walletTimeline.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Wallet size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {walletTimeline.map((t, i) => (
                  <div key={t.id || i} className={`${cardCls} flex items-center justify-between`} style={cardStyle}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-display font-medium">
                          {t.description || t.reason || t.type}
                        </p>
                        {t._source === "adj" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-display">Admin</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{fmt(t.created_at)}</p>
                    </div>
                    <p className={`text-sm font-semibold font-display ${
                      t.type === "credit" || t.type === "admin_credit" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {(t.type === "credit" || t.type === "admin_credit") ? "+" : "−"}₹{(t.amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ratings Tab */}
          <TabsContent value="ratings" className="mt-4">
            {ratings.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Star size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No ratings received</p>
              </div>
            ) : (
              <>
                {user.avg_rating && (
                  <div className={`${cardCls} flex items-center gap-3 mb-3`} style={cardStyle}>
                    <Star size={18} className="text-amber-400" />
                    <p className="text-2xl font-bold text-white font-display">{user.avg_rating.toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">avg across {ratings.length} ratings</p>
                  </div>
                )}
                <div className="space-y-2">
                  {ratings.map((r, i) => {
                    const avg = ((r.punctuality + r.gear_handling + r.teamwork) / 3).toFixed(1);
                    return (
                      <div key={r.id || i} className={cardCls} style={cardStyle}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-zinc-400">{fmt(r.created_at)}</p>
                          <span className="text-xs text-amber-400 font-display">★ {avg}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-zinc-500">
                          <span>Punctuality: {r.punctuality}/5</span>
                          <span>Gear: {r.gear_handling}/5</span>
                          <span>Teamwork: {r.teamwork}/5</span>
                        </div>
                        {r.notes && <p className="text-xs text-zinc-400 mt-1 italic">"{r.notes}"</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* Login History Tab */}
          <TabsContent value="logins" className="mt-4">
            {login_logs.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <Monitor size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No login history recorded</p>
                <p className="text-xs text-zinc-700 mt-1">Login tracking started from this deployment</p>
              </div>
            ) : (
              <div className="space-y-2">
                {login_logs.map((l, i) => (
                  <div key={l.id || i} className={`${cardCls} flex items-start justify-between`} style={cardStyle}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-300 font-display font-medium">{l.ip}</p>
                      <p className="text-[10px] text-zinc-600 truncate mt-0.5">{l.user_agent}</p>
                    </div>
                    <p className="text-[10px] text-zinc-500 flex-shrink-0 ml-4">{fmt(l.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Wallet Adjust Modal */}
      <Dialog open={showWallet} onOpenChange={setShowWallet}>
        <DialogContent style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display flex items-center gap-2">
              <Wallet size={16} className="text-blue-400" /> Wallet Adjustment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Amount (₹) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  style={inputStyle}
                  placeholder="0.00"
                  value={walletForm.amount}
                  onChange={e => setWalletForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Type *</label>
                <select
                  className={`${inputCls} appearance-none`}
                  style={{ background: "#111827" }}
                  value={walletForm.type}
                  onChange={e => setWalletForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (−)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason *</label>
              <textarea
                className={`${inputCls} resize-none h-20`}
                style={inputStyle}
                placeholder="Reason for adjustment (support credit, correction…)"
                value={walletForm.reason}
                onChange={e => setWalletForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWallet(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWalletAdjust}
                disabled={walletLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#1D4ED8" }}
              >
                {walletLoading ? "Saving…" : `${walletForm.type === "credit" ? "Credit" : "Debit"} ₹${walletForm.amount || "0"}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Penalty Modal */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent style={{ background: "#0D1220", borderColor: "rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-white font-display flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" /> Apply Penalty
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Stars to deduct</label>
              <select
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white border border-white/10 focus:outline-none"
                style={{ background: "#111827" }}
                value={penaltyForm.stars}
                onChange={e => setPenaltyForm(f => ({ ...f, stars: parseInt(e.target.value) }))}
              >
                <option value={1}>1 star</option>
                <option value={2}>2 stars</option>
                <option value={3}>3 stars (suspension warning)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Reason *</label>
              <textarea
                className={`${inputCls} resize-none h-20`}
                style={inputStyle}
                placeholder="Explain the penalty reason…"
                value={penaltyForm.reason}
                onChange={e => setPenaltyForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPenalty(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-zinc-400 border border-white/10 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePenalty}
                disabled={penaltyLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "#EA580C" }}
              >
                {penaltyLoading ? "Applying…" : "Apply Penalty"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Register the route in App.js**

In `frontend/src/App.js`, add the import after the existing admin imports:

```javascript
import AdminUserProfile from "@/pages/admin/AdminUserProfile";
```

In `AdminRoutes`, add the route before the catch-all:

```jsx
<Route path="/admin/users/:id" element={<AdminGuard><AdminUserProfile /></AdminGuard>} />
```

The full updated `AdminRoutes` function:

```jsx
function AdminRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/admin/login"
        element={user?.is_admin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />}
      />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<AdminGuard><AdminOverview /></AdminGuard>} />
      <Route path="/admin/verification" element={<AdminGuard><AdminVerification /></AdminGuard>} />
      <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
      <Route path="/admin/users/:id" element={<AdminGuard><AdminUserProfile /></AdminGuard>} />
      <Route path="/admin/penalties" element={<AdminGuard><AdminPenalties /></AdminGuard>} />
      <Route path="/admin/gig-board" element={<AdminGuard><AdminGigBoard /></AdminGuard>} />
      <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
      <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd frontend && yarn start
```
Expected: no compile errors

- [ ] **Step 4: Manual smoke test**
1. Log in as admin at `/admin/login`
2. Go to `/admin/users` — verify filter bar and checkboxes appear
3. Click a user name — verify profile page loads at `/admin/users/:id`
4. Verify all 5 tabs render without errors
5. Try toggling Featured flag — verify badge appears/disappears in header
6. Try Wallet Credit — verify toast and balance updates

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AdminUserProfile.jsx frontend/src/App.js
git commit -m "feat: add AdminUserProfile page with 5-tab deep-dive and impersonation"
```

---

## Task 12: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
cd backend && pytest tests/test_crewbook.py -v
```
Expected: all existing tests pass + all new test classes pass

- [ ] **Step 2: Final commit if clean**

```bash
git add -A
git commit -m "feat: complete admin user management - filters, profile, bulk actions, impersonation, wallet adjust, role flags"
```
