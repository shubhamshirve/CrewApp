from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user
from services.notifications_service import send_notification

router = APIRouter(prefix="/ratings")


class RatingSubmit(BaseModel):
    gig_id: str
    rated_user_id: str
    punctuality: int  # 1-5
    gear_handling: int
    teamwork: int
    notes: Optional[str] = None  # Private lead notes


class AppealRequest(BaseModel):
    reason: str
    gig_id: Optional[str] = None


@router.get("/pending")
async def get_pending_ratings(current_user: dict = Depends(get_current_user)):
    """
    Returns gigs awaiting rating from current user, with the specific users to rate.
    Lead photographers rate accepted freelancers; freelancers rate the lead.
    """
    db = get_db()
    uid = current_user["id"]
    result = []

    # ── As Lead: rate each accepted freelancer on completed gigs ──────────────
    lead_gigs = await db.gigs.find(
        {"lead_photographer_id": uid, "status": "completed"}
    ).sort("updated_at", -1).to_list(50)

    for gig in lead_gigs:
        gig_id = gig["_id"]
        accepted_invites = await db.gig_invites.find(
            {"gig_id": gig_id, "status": "accepted"}
        ).to_list(50)
        users_to_rate = []
        for inv in accepted_invites:
            already = await db.ratings.find_one({
                "gig_id": gig_id,
                "rater_id": uid,
                "rated_user_id": inv["freelancer_id"],
            })
            if not already:
                fl = await db.users.find_one(
                    {"_id": inv["freelancer_id"]},
                    {"password_hash": 0, "_id": 0}
                )
                if fl:
                    users_to_rate.append({
                        "user_id": inv["freelancer_id"],
                        "full_name": fl.get("full_name", "Unknown"),
                        "primary_role": fl.get("primary_role", ""),
                        "role": inv["role"],
                    })
        if users_to_rate:
            gig_dict = dict(gig)
            gig_dict["id"] = str(gig_dict.pop("_id"))
            result.append({"gig": gig_dict, "users_to_rate": users_to_rate})

    # ── As Freelancer: rate the lead on completed gigs ────────────────────────
    my_invites = await db.gig_invites.find(
        {"freelancer_id": uid, "status": "accepted"}
    ).to_list(100)

    rated_gig_ids_as_freelancer = set()
    for inv in my_invites:
        gig = await db.gigs.find_one({"_id": inv["gig_id"], "status": "completed"})
        if not gig:
            continue
        gig_id = gig["_id"]
        if gig_id in rated_gig_ids_as_freelancer:
            continue
        already = await db.ratings.find_one({
            "gig_id": gig_id,
            "rater_id": uid,
            "rated_user_id": gig["lead_photographer_id"],
        })
        if not already:
            lead = await db.users.find_one(
                {"_id": gig["lead_photographer_id"]},
                {"password_hash": 0, "_id": 0}
            )
            if lead:
                gig_dict = dict(gig)
                gig_dict["id"] = str(gig_dict.pop("_id"))
                result.append({
                    "gig": gig_dict,
                    "users_to_rate": [{
                        "user_id": gig["lead_photographer_id"],
                        "full_name": lead.get("full_name", "Unknown"),
                        "primary_role": lead.get("primary_role", ""),
                        "role": "Lead Photographer",
                    }],
                })
                rated_gig_ids_as_freelancer.add(gig_id)

    return result


@router.post("")
async def submit_rating(data: RatingSubmit, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.gigs.find_one({"_id": data.gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    existing = await db.ratings.find_one({"gig_id": data.gig_id, "rater_id": current_user["id"], "rated_user_id": data.rated_user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this user for this gig")

    avg = round((data.punctuality + data.gear_handling + data.teamwork) / 3, 2)
    now = datetime.now(timezone.utc).isoformat()
    rating_doc = {
        "_id": str(uuid.uuid4()),
        "gig_id": data.gig_id,
        "gig_title": gig.get("title", ""),
        "rater_id": current_user["id"],
        "rated_user_id": data.rated_user_id,
        "punctuality": data.punctuality,
        "gear_handling": data.gear_handling,
        "teamwork": data.teamwork,
        "avg_score": avg,
        "notes": data.notes,
        "created_at": now,
    }
    await db.ratings.insert_one(rating_doc)

    # Update user's aggregate rating
    all_ratings = await db.ratings.find({"rated_user_id": data.rated_user_id}).to_list(1000)
    if all_ratings:
        total_avg = round(sum(r["avg_score"] for r in all_ratings) / len(all_ratings), 2)
        await db.users.update_one(
            {"_id": data.rated_user_id},
            {"$set": {"avg_rating": total_avg, "total_ratings": len(all_ratings)}}
        )
    return {"message": "Rating submitted", "avg_score": avg}


@router.get("/user/{user_id}")
async def get_user_ratings(user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    ratings = await db.ratings.find({"rated_user_id": user_id}).to_list(100)
    anonymized = []
    for r in ratings:
        anonymized.append({
            "gig_title": r.get("gig_title", ""),
            "punctuality": r["punctuality"],
            "gear_handling": r["gear_handling"],
            "teamwork": r["teamwork"],
            "avg_score": r["avg_score"],
            "created_at": r["created_at"],
        })
    user = await db.users.find_one({"_id": user_id})
    return {
        "avg_rating": user.get("avg_rating") if user else None,
        "total_ratings": user.get("total_ratings", 0) if user else 0,
        "ratings": anonymized
    }


@router.post("/appeal")
async def appeal_penalty(data: AppealRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    appeal = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "reason": data.reason,
        "gig_id": data.gig_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.penalty_appeals.insert_one(appeal)
    # Notify admins
    admins = await db.users.find({"is_admin": True}).to_list(10)
    for admin in admins:
        await send_notification(
            db, str(admin["_id"]), "appeal",
            "Penalty Appeal Filed",
            f"{current_user['full_name']} filed a penalty appeal: {data.reason[:80]}",
            {"appeal_id": appeal["_id"]}
        )
    return {"message": "Appeal submitted. Admin will review within 48 hours."}
