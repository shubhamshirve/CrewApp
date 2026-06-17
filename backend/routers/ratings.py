from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user
from services.notifications_service import send_notification
from rate_limit import limiter
from fastapi import Request

router = APIRouter(prefix="/ratings")


class RatingSubmit(BaseModel):
    gig_id: str
    rated_user_id: str
    punctuality: int = Field(..., ge=1, le=5, description="Rating 1–5")
    gear_handling: int = Field(..., ge=1, le=5, description="Rating 1–5")
    teamwork: int = Field(..., ge=1, le=5, description="Rating 1–5")
    notes: Optional[str] = Field(None, max_length=1000)  # Private, never returned publicly


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
@limiter.limit("10/minute")
async def submit_rating(request: Request, data: RatingSubmit, current_user: dict = Depends(get_current_user)):
    db = get_db()
    rater_id = current_user["id"]

    # ── Self-rating guard ──────────────────────────────────────────────────────
    if rater_id == data.rated_user_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    # ── Gig existence & completion check ──────────────────────────────────────
    gig = await db.gigs.find_one({"_id": data.gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Ratings are only allowed after a gig is completed")

    # ── Same-booking membership validation ────────────────────────────────────
    # Rater must be the lead OR an accepted freelancer on this gig
    if gig["lead_photographer_id"] == rater_id:
        rater_is_member = True
    else:
        rater_invite = await db.gig_invites.find_one({
            "gig_id": data.gig_id, "freelancer_id": rater_id, "status": "accepted"
        })
        rater_is_member = rater_invite is not None
    if not rater_is_member:
        raise HTTPException(status_code=403, detail="You were not part of this booking")

    # Rated user must also be on the same gig (lead or accepted freelancer)
    if gig["lead_photographer_id"] == data.rated_user_id:
        rated_is_member = True
    else:
        rated_invite = await db.gig_invites.find_one({
            "gig_id": data.gig_id, "freelancer_id": data.rated_user_id, "status": "accepted"
        })
        rated_is_member = rated_invite is not None
    if not rated_is_member:
        raise HTTPException(status_code=403, detail="That user was not part of this booking")

    # ── Duplicate prevention ───────────────────────────────────────────────────
    existing = await db.ratings.find_one({
        "gig_id": data.gig_id, "rater_id": rater_id, "rated_user_id": data.rated_user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already rated this user for this gig")

    avg = round((data.punctuality + data.gear_handling + data.teamwork) / 3, 2)
    now = datetime.now(timezone.utc).isoformat()
    rating_doc = {
        "_id": str(uuid.uuid4()),
        "gig_id": data.gig_id,
        "gig_title": gig.get("title", ""),
        "rater_id": rater_id,
        "rated_user_id": data.rated_user_id,
        "punctuality": data.punctuality,
        "gear_handling": data.gear_handling,
        "teamwork": data.teamwork,
        "avg_score": avg,
        "notes": data.notes,
        "created_at": now,
    }
    await db.ratings.insert_one(rating_doc)

    # ── Aggregate avg_rating via MongoDB pipeline (efficient, no to_list scan) ──
    pipeline = [
        {"$match": {"rated_user_id": data.rated_user_id}},
        {"$group": {
            "_id": "$rated_user_id",
            "avg_rating":    {"$avg": "$avg_score"},
            "total_ratings": {"$sum": 1},
        }},
    ]
    agg = await db.ratings.aggregate(pipeline).to_list(1)
    if agg:
        await db.users.update_one(
            {"_id": data.rated_user_id},
            {"$set": {
                "avg_rating":    round(agg[0]["avg_rating"], 2),
                "total_ratings": agg[0]["total_ratings"],
            }},
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
