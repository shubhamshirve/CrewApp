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

    await db.users.update_one({"_id": user_id}, {"$set": updates})
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
