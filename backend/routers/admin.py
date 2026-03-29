from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_admin_user, _clean_user, create_impersonation_token
from services.notifications_service import send_notification
from services.log_service import log_admin_action

router = APIRouter(prefix="/admin")


class VerifyRequest(BaseModel):
    action: str  # approved / rejected
    reason: Optional[str] = None


class PenaltyRequest(BaseModel):
    reason: str
    stars: int = 1


class BulkActionRequest(BaseModel):
    action: str  # suspend | unsuspend | verify | notify
    user_ids: List[str]
    title: Optional[str] = None
    message: Optional[str] = None


class WalletAdjustRequest(BaseModel):
    amount: float
    type: str  # credit | debit
    reason: str


class UserFlagsRequest(BaseModel):
    is_featured: Optional[bool] = None
    is_high_risk: Optional[bool] = None


@router.get("/verification-queue")
async def get_verification_queue(admin: dict = Depends(get_admin_user)):
    db = get_db()
    pending = await db.users.find(
        {"verification_status": "pending"},
        {"password_hash": 0}
    ).to_list(100)
    return [_clean_user(u) for u in pending]


@router.put("/verify/{user_id}")
async def verify_user(user_id: str, data: VerifyRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_approved = data.action == "approved"
    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "verification_status": data.action,
                "is_verified": is_approved,
                "verification_reason": data.reason,
                "verified_at": datetime.now(timezone.utc).isoformat() if is_approved else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )
    await log_admin_action(
        db, admin, "verify_user" if is_approved else "reject_user",
        "user", user_id,
        {"verification_status": user.get("verification_status")},
        {"verification_status": data.action},
    )
    title = "ID Verification Approved!" if is_approved else "ID Verification Rejected"
    message = (
        "Your account is now verified. You can start booking and getting booked!"
        if is_approved
        else f"Your ID verification was rejected. Reason: {data.reason or 'Please resubmit clearer documents.'}"
    )
    await send_notification(db, user_id, "verification", title, message)
    return {"message": f"User {data.action}"}


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
    for log_entry in login_logs:
        log_entry["id"] = str(log_entry.pop("_id"))

    return {
        "user": _clean_user(user),
        "gigs": gigs,
        "invites": invites,
        "wallet_transactions": wallet_txns,
        "wallet_adjustments": wallet_adjs,
        "ratings": ratings,
        "login_logs": login_logs,
    }


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

    await log_admin_action(
        db, admin, f"bulk_{data.action}",
        "users", ",".join(data.user_ids[:10]),
        {},
        {"action": data.action, "count": updated},
    )
    return {"updated": updated}


@router.post("/impersonate/{user_id}")
async def impersonate_user(user_id: str, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot impersonate an admin account")
    token = create_impersonation_token(user_id=user_id, admin_id=admin["id"])
    return {"token": token, "expires_in": 3600}


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
    await db.wallet_adjustments.insert_one({
        "_id": str(uuid.uuid4()),
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
    await log_admin_action(
        db, admin, f"wallet_{data.type}",
        "user", user_id,
        {"wallet_balance": current_balance},
        {"wallet_balance": new_balance, "amount": data.amount, "reason": data.reason},
    )
    await send_notification(
        db, user_id, "wallet",
        f"Wallet {'Credited' if data.type == 'credit' else 'Debited'}",
        f"₹{data.amount:.2f} {'added to' if data.type == 'credit' else 'deducted from'} your wallet. Reason: {data.reason}",
        {},
    )
    return {"new_balance": new_balance}


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

    before_flags = {
        "is_featured": user.get("is_featured", False),
        "is_high_risk": user.get("is_high_risk", False),
    }
    await db.users.update_one({"_id": user_id}, {"$set": updates})
    await log_admin_action(
        db, admin, "set_flags",
        "user", user_id,
        before_flags,
        {k: v for k, v in updates.items() if k != "updated_at"},
    )
    updated = await db.users.find_one({"_id": user_id})
    return {
        "is_featured": updated.get("is_featured", False),
        "is_high_risk": updated.get("is_high_risk", False),
    }


@router.get("/stats")
async def get_stats(admin: dict = Depends(get_admin_user)):
    db = get_db()
    total_users = await db.users.count_documents({})
    verified = await db.users.count_documents({"is_verified": True})
    pending_verification = await db.users.count_documents({"verification_status": "pending"})
    active_subs = await db.users.count_documents({"subscription_plan": {"$in": ["base", "premium"]}})
    total_gigs = await db.gigs.count_documents({})
    return {
        "total_users": total_users,
        "verified_users": verified,
        "pending_verification": pending_verification,
        "active_subscriptions": active_subs,
        "total_gigs": total_gigs,
    }


@router.post("/penalty/{user_id}")
async def add_penalty(user_id: str, data: PenaltyRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_stars = user.get("negative_stars", 0) + data.stars
    is_suspended = new_stars >= 5

    await db.users.update_one(
        {"_id": user_id},
        {
            "$set": {
                "negative_stars": new_stars,
                "is_suspended": is_suspended,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )
    await log_admin_action(
        db, admin, "add_penalty",
        "user", user_id,
        {"negative_stars": user.get("negative_stars", 0), "is_suspended": user.get("is_suspended", False)},
        {"negative_stars": new_stars, "is_suspended": is_suspended, "reason": data.reason},
    )
    title = "Account Suspended" if is_suspended else f"Penalty Applied ({new_stars}/5)"
    message = (
        "Your account has been suspended due to accumulated penalties."
        if is_suspended
        else f"You received {data.stars} negative star(s). Reason: {data.reason}. ({new_stars}/5 stars)"
    )
    await send_notification(db, user_id, "penalty", title, message)
    return {"negative_stars": new_stars, "is_suspended": is_suspended}


@router.put("/suspend/{user_id}")
async def toggle_suspend(user_id: str, admin: dict = Depends(get_admin_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_state = not user.get("is_suspended", False)
    await db.users.update_one({"_id": user_id}, {"$set": {"is_suspended": new_state}})
    await log_admin_action(
        db, admin, "toggle_suspend",
        "user", user_id,
        {"is_suspended": not new_state},
        {"is_suspended": new_state},
    )
    return {"is_suspended": new_state}


@router.get("/penalties")
async def get_penalties(
    limit: int = 50,
    skip: int = 0,
    admin: dict = Depends(get_admin_user),
):
    """Return all penalty actions from admin audit log, enriched with user names."""
    db = get_db()
    limit = min(limit, 100)
    logs = await db.admin_logs.find(
        {"action": "add_penalty"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_logs.count_documents({"action": "add_penalty"})

    result = []
    for log in logs:
        user = await db.users.find_one({"_id": log["target_id"]}, {"full_name": 1, "_id": 0})
        result.append({
            "id": log.get("target_id"),
            "user_id": log["target_id"],
            "user_name": user.get("full_name", "Unknown") if user else "Unknown",
            "reason": log.get("after", {}).get("reason", ""),
            "stars": log.get("after", {}).get("negative_stars", 1) - log.get("before", {}).get("negative_stars", 0),
            "total_stars": log.get("after", {}).get("negative_stars", 0),
            "created_at": log["created_at"],
            "admin_email": log.get("admin_email", ""),
        })
    return {"items": result, "total": total}


class AppealReviewRequest(BaseModel):
    action: str  # approve | reject
    admin_note: Optional[str] = None


@router.get("/appeals")
async def get_appeals(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    """Return all penalty appeals with user information."""
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    appeals = await db.penalty_appeals.find(query).sort("created_at", -1).to_list(100)
    result = []
    for ap in appeals:
        user = await db.users.find_one(
            {"_id": ap["user_id"]},
            {"full_name": 1, "email": 1, "negative_stars": 1, "_id": 0}
        )
        result.append({
            "id": ap["_id"],
            "user_id": ap["user_id"],
            "user_name": user.get("full_name", "Unknown") if user else "Unknown",
            "user_email": user.get("email", "") if user else "",
            "user_stars": user.get("negative_stars", 0) if user else 0,
            "reason": ap.get("reason", ""),
            "gig_id": ap.get("gig_id"),
            "status": ap.get("status", "pending"),
            "admin_note": ap.get("admin_note"),
            "reviewed_at": ap.get("reviewed_at"),
            "created_at": ap["created_at"],
        })
    return result


@router.put("/appeals/{appeal_id}")
async def review_appeal(appeal_id: str, data: AppealReviewRequest, admin: dict = Depends(get_admin_user)):
    """Admin reviews a penalty appeal — approve or reject."""
    db = get_db()
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve or reject")
    appeal = await db.penalty_appeals.find_one({"_id": appeal_id})
    if not appeal:
        raise HTTPException(status_code=404, detail="Appeal not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.penalty_appeals.update_one(
        {"_id": appeal_id},
        {"$set": {"status": data.action + "d", "admin_note": data.admin_note, "reviewed_at": now}}
    )

    if data.action == "approve":
        # Reduce 1 negative star from the user
        await db.users.update_one(
            {"_id": appeal["user_id"]},
            {"$inc": {"negative_stars": -1}}
        )
        user = await db.users.find_one({"_id": appeal["user_id"]})
        if user and user.get("negative_stars", 0) < 5:
            await db.users.update_one({"_id": appeal["user_id"]}, {"$set": {"is_suspended": False}})

    await send_notification(
        db, appeal["user_id"], "appeal",
        "Appeal " + ("Approved" if data.action == "approve" else "Rejected"),
        (
            "Your penalty appeal has been approved. 1 negative star has been removed."
            if data.action == "approve"
            else f"Your penalty appeal was rejected. {data.admin_note or 'No additional notes.'}"
        ),
        {"appeal_id": appeal_id}
    )
    await log_admin_action(
        db, admin, f"appeal_{data.action}",
        "appeal", appeal_id,
        {"status": "pending"},
        {"status": data.action + "d", "admin_note": data.admin_note},
    )
    return {"message": f"Appeal {data.action}d"}


@router.post("/seed-admin")
async def seed_admin():
    """Creates default admin account if none exists."""
    from auth_utils import hash_password
    import uuid
    db = get_db()
    existing = await db.users.find_one({"is_admin": True})
    if existing:
        return {"message": "Admin already exists"}
    now = datetime.now(timezone.utc).isoformat()
    admin_doc = {
        "_id": str(uuid.uuid4()),
        "email": "admin@crewbook.in",
        "password_hash": hash_password("Admin@123"),
        "full_name": "CrewBook Admin",
        "phone": "9999999999",
        "location": "Mumbai",
        "pincode": "400001",
        "is_admin": True,
        "is_verified": True,
        "verification_status": "approved",
        "subscription_plan": "premium",
        "wallet_balance": 0.0,
        "negative_stars": 0,
        "is_suspended": False,
        "is_ghost_mode": False,
        "is_standby": False,
        "referral_code": "ADMIN00001",
        "gear_vault": [],
        "style_tags": [],
        "editing_ecosystem": [],
        "onboarding_complete": True,
        "total_ratings": 0,
        "avg_rating": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(admin_doc)
    return {"message": "Admin created", "email": "admin@crewbook.in", "password": "Admin@123"}


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
