from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from db import get_db
from auth_utils import get_admin_user, _clean_user
from services.notifications_service import send_notification

router = APIRouter(prefix="/admin")


class VerifyRequest(BaseModel):
    action: str  # approved / rejected
    reason: Optional[str] = None


class PenaltyRequest(BaseModel):
    reason: str
    stars: int = 1


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
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
    query = {}
    if status:
        query["verification_status"] = status
    skip = (page - 1) * limit
    users = await db.users.find(query, {"password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": [_clean_user(u) for u in users], "total": total, "page": page}


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
