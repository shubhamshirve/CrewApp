from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from db import get_db
from auth_utils import get_current_user, _clean_user
from services.notifications_service import send_notification

router = APIRouter(prefix="/public-gigs")

EVENT_TYPES = ["Haldi", "Mehendi", "Sangam", "Sangeet", "Baraat", "Wedding",
               "Reception", "Pre-Wedding Shoot", "Corporate", "Birthday", "Other"]


# ── Models ──────────────────────────────────────────────────────────────────

class RoleSpec(BaseModel):
    role: str
    budget: float
    slots: int = 1
    verified_only: bool = False
    min_rating: Optional[float] = None
    style_tags: Optional[List[str]] = None
    gear_required: Optional[str] = None


class CreatePublicGig(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str
    date: str
    city: str
    location: str
    venue_name: Optional[str] = None
    style_preference: Optional[str] = None
    roles: List[RoleSpec]
    expires_hours: int = 48


class ApplyRequest(BaseModel):
    role_id: str
    offer_price: float
    cover_note: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pg(g: dict) -> dict:
    g = dict(g)
    if "_id" in g:
        g["id"] = str(g.pop("_id"))
    return g


def _app(a: dict) -> dict:
    if not a:
        return None
    a = dict(a)
    if "_id" in a:
        a["id"] = str(a.pop("_id"))
    return a


def _compute_match(gig: dict, user: dict) -> int:
    user_roles = {user.get("primary_role"), user.get("secondary_role")} - {None}
    user_styles = set(user.get("style_tags", []))
    user_rating = user.get("avg_rating") or 0
    score = 0
    for r in gig.get("roles", []):
        if r["role"] in user_roles and r.get("filled_count", 0) < r.get("slots", 1):
            score += 60
            if r.get("verified_only") and user.get("is_verified"):
                score += 10
            if r.get("min_rating") and user_rating >= r["min_rating"]:
                score += 10
            break
    if gig.get("style_preference") in user_styles:
        score += 20
    return min(score, 100)


def _has_public_gig_access(user: dict) -> bool:
    """Return True if user is admin OR their active plan grants public gig board access."""
    if user.get("is_admin"):
        return True
    features = user.get("active_plan_features") or {}
    if features:
        return bool(features.get("public_gig_enabled", False))
    return False


def _require_public_gig_access(user: dict):
    if not _has_public_gig_access(user):
        raise HTTPException(
            status_code=403,
            detail="Public Gig Board access requires a plan with Gig Board enabled. Upgrade your plan from Wallet.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/event-types")
async def get_event_types():
    return EVENT_TYPES


@router.post("")
async def create_public_gig(data: CreatePublicGig, current_user: dict = Depends(get_current_user)):
    _require_public_gig_access(current_user)
    if not current_user.get("is_verified") and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only verified users can post public gigs")
    if not data.roles:
        raise HTTPException(status_code=400, detail="At least one role is required")

    db = get_db()
    now = datetime.now(timezone.utc)
    roles = [{"id": str(uuid.uuid4()), **r.model_dump(), "filled_count": 0} for r in data.roles]

    gig = {
        "_id": str(uuid.uuid4()),
        "lead_id": current_user["id"],
        "lead_name": current_user["full_name"],
        "lead_rating": current_user.get("avg_rating"),
        "lead_verified": current_user.get("is_verified", False),
        "title": data.title,
        "description": data.description or "",
        "event_type": data.event_type,
        "date": data.date,
        "city": data.city,
        "location": data.location,
        "venue_name": data.venue_name or "",
        "style_preference": data.style_preference or "",
        "roles": roles,
        "status": "open",
        "expires_at": (now + timedelta(hours=data.expires_hours)).isoformat(),
        "view_count": 0,
        "application_count": 0,
        "converted_gig_id": None,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.public_gigs.insert_one(gig)
    return _pg(gig)


@router.get("")
async def browse_gig_board(
    role: Optional[str] = None,
    city: Optional[str] = None,
    date: Optional[str] = None,
    budget_min: Optional[float] = None,
    budget_max: Optional[float] = None,
    event_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    _require_public_gig_access(current_user)
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.public_gigs.update_many(
        {"status": "open", "expires_at": {"$lt": now_iso}},
        {"$set": {"status": "expired"}}
    )

    query: dict = {
        "status": {"$in": ["open", "partially_filled"]},
        "lead_id": {"$ne": current_user["id"]},
    }
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if date:
        query["date"] = date
    if event_type:
        query["event_type"] = event_type

    if role or budget_min is not None or budget_max is not None:
        em: dict = {}
        if role:
            em["role"] = role
        if budget_min is not None or budget_max is not None:
            b: dict = {}
            if budget_min is not None:
                b["$gte"] = budget_min
            if budget_max is not None:
                b["$lte"] = budget_max
            em["budget"] = b
        query["roles"] = {"$elemMatch": em}

    gigs = await db.public_gigs.find(query).sort("created_at", -1).limit(50).to_list(50)
    result = []
    for g in gigs:
        g_dict = _pg(g)
        g_dict["match_score"] = _compute_match(g, current_user)
        app = await db.public_gig_applications.find_one({
            "public_gig_id": g_dict["id"], "applicant_id": current_user["id"]
        })
        g_dict["has_applied"] = app is not None
        g_dict["my_application"] = _app(app)
        result.append(g_dict)

    result.sort(key=lambda x: x["match_score"], reverse=True)
    return result


@router.get("/my-posts")
async def get_my_public_gigs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    gigs = await db.public_gigs.find({"lead_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    return [_pg(g) for g in gigs]


@router.get("/applications/my")
async def get_my_applications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    apps = await db.public_gig_applications.find(
        {"applicant_id": current_user["id"]}
    ).sort("created_at", -1).to_list(50)
    result = []
    for a in apps:
        a_dict = _app(a)
        gig = await db.public_gigs.find_one({"_id": a["public_gig_id"]})
        a_dict["gig"] = _pg(gig) if gig else None
        result.append(a_dict)
    return result


@router.get("/{gig_id}")
async def get_public_gig(gig_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.public_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")

    if gig["lead_id"] != current_user["id"]:
        await db.public_gigs.update_one({"_id": gig_id}, {"$inc": {"view_count": 1}})

    gig_dict = _pg(gig)
    gig_dict["match_score"] = _compute_match(gig, current_user)
    gig_dict["is_lead"] = gig["lead_id"] == current_user["id"]

    if gig["lead_id"] == current_user["id"]:
        apps = await db.public_gig_applications.find({"public_gig_id": gig_id}).sort("created_at", -1).to_list(100)
        enriched = []
        for a in apps:
            a_dict = _app(a)
            applicant = await db.users.find_one({"_id": a["applicant_id"]}, {"password_hash": 0})
            a_dict["applicant"] = _clean_user(applicant) if applicant else None
            enriched.append(a_dict)
        gig_dict["applications"] = enriched
    else:
        app = await db.public_gig_applications.find_one({
            "public_gig_id": gig_id, "applicant_id": current_user["id"]
        })
        gig_dict["my_application"] = _app(app)

    return gig_dict


@router.post("/{gig_id}/apply")
async def apply_to_public_gig(gig_id: str, data: ApplyRequest, current_user: dict = Depends(get_current_user)):
    _require_public_gig_access(current_user)
    db = get_db()
    gig = await db.public_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot apply to your own gig")
    if gig["status"] not in ("open", "partially_filled"):
        raise HTTPException(status_code=400, detail="This gig is no longer accepting applications")

    role_spec = next((r for r in gig["roles"] if r["id"] == data.role_id), None)
    if not role_spec:
        raise HTTPException(status_code=404, detail="Role not found in this gig")
    if role_spec.get("filled_count", 0) >= role_spec.get("slots", 1):
        raise HTTPException(status_code=400, detail="This role is already filled")
    if role_spec.get("verified_only") and not current_user.get("is_verified"):
        raise HTTPException(status_code=403, detail="This role requires a verified account")
    if role_spec.get("min_rating"):
        rating = current_user.get("avg_rating") or 0
        if current_user.get("total_ratings", 0) > 0 and rating < role_spec["min_rating"]:
            raise HTTPException(status_code=403, detail=f"This role requires a minimum rating of {role_spec['min_rating']}")

    existing = await db.public_gig_applications.find_one({
        "public_gig_id": gig_id,
        "applicant_id": current_user["id"],
        "role_id": data.role_id,
        "status": {"$ne": "rejected"},
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already applied for this role")

    now = datetime.now(timezone.utc).isoformat()
    application = {
        "_id": str(uuid.uuid4()),
        "public_gig_id": gig_id,
        "gig_title": gig["title"],
        "role_id": data.role_id,
        "role_name": role_spec["role"],
        "applicant_id": current_user["id"],
        "applicant_name": current_user["full_name"],
        "offer_price": data.offer_price,
        "cover_note": data.cover_note or "",
        "status": "pending",
        "created_at": now,
    }
    await db.public_gig_applications.insert_one(application)
    await db.public_gigs.update_one({"_id": gig_id}, {"$inc": {"application_count": 1}})

    await send_notification(
        db, gig["lead_id"], "invite",
        f"New Application: {gig['title']}",
        f"{current_user['full_name']} applied for {role_spec['role']} at ₹{data.offer_price:.0f}",
        {"public_gig_id": gig_id, "application_id": application["_id"]}
    )

    application["id"] = application.pop("_id")
    return application


@router.put("/{gig_id}/applications/{app_id}/accept")
async def accept_application(gig_id: str, app_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.public_gigs.find_one({"_id": gig_id, "lead_id": current_user["id"]})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found or access denied")

    app = await db.public_gig_applications.find_one({"_id": app_id, "public_gig_id": gig_id, "status": "pending"})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found or already processed")

    now = datetime.now(timezone.utc).isoformat()
    await db.public_gig_applications.update_one({"_id": app_id}, {"$set": {"status": "accepted", "updated_at": now}})

    # Update role filled_count
    role_id = app["role_id"]
    role_spec = next((r for r in gig["roles"] if r["id"] == role_id), {})
    new_filled = role_spec.get("filled_count", 0) + 1
    await db.public_gigs.update_one(
        {"_id": gig_id, "roles.id": role_id},
        {"$set": {"roles.$.filled_count": new_filled}}
    )

    # Recalculate overall status
    refreshed = await db.public_gigs.find_one({"_id": gig_id})
    all_filled = all(r.get("filled_count", 0) >= r.get("slots", 1) for r in refreshed["roles"])
    any_filled = any(r.get("filled_count", 0) > 0 for r in refreshed["roles"])
    new_status = "filled" if all_filled else ("partially_filled" if any_filled else "open")
    await db.public_gigs.update_one({"_id": gig_id}, {"$set": {"status": new_status, "updated_at": now}})

    # Create or reuse regular gig for calendar/bookings integration
    converted_gig_id = gig.get("converted_gig_id")
    if not converted_gig_id:
        session_id = str(uuid.uuid4())
        regular_gig = {
            "_id": str(uuid.uuid4()),
            "lead_photographer_id": current_user["id"],
            "lead_name": current_user["full_name"],
            "title": gig["title"],
            "description": gig.get("description", ""),
            "sessions": [{
                "id": session_id,
                "date": gig["date"],
                "start_time": "09:00",
                "end_time": "18:00",
                "location": gig["location"],
                "venue_name": gig.get("venue_name", ""),
                "event_type": gig["event_type"],
            }],
            "status": "active",
            "workspace_files": [],
            "data_delivered": False,
            "source": "public_gig",
            "public_gig_id": gig_id,
            "created_at": now,
            "updated_at": now,
        }
        await db.gigs.insert_one(regular_gig)
        converted_gig_id = regular_gig["_id"]
        await db.public_gigs.update_one({"_id": gig_id}, {"$set": {"converted_gig_id": converted_gig_id}})

    regular_gig_doc = await db.gigs.find_one({"_id": converted_gig_id})
    session = regular_gig_doc["sessions"][0]

    # Create an accepted invite so freelancer sees it in My Gigs & Calendar
    invite = {
        "_id": str(uuid.uuid4()),
        "gig_id": converted_gig_id,
        "gig_title": gig["title"],
        "session_id": session["id"],
        "session_date": gig["date"],
        "lead_id": current_user["id"],
        "lead_name": current_user["full_name"],
        "freelancer_id": app["applicant_id"],
        "role": app["role_name"],
        "proposed_fee": app["offer_price"],
        "agreed_fee": app["offer_price"],
        "status": "accepted",
        "expires_at": now,
        "source": "public_gig",
        "public_gig_id": gig_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.gig_invites.insert_one(invite)

    await send_notification(
        db, app["applicant_id"], "accepted",
        "Application Accepted!",
        f"Your application for {app['role_name']} in '{gig['title']}' was accepted at ₹{app['offer_price']:.0f}",
        {"gig_id": converted_gig_id, "public_gig_id": gig_id}
    )
    return {"status": "accepted", "converted_gig_id": converted_gig_id}


@router.put("/{gig_id}/applications/{app_id}/reject")
async def reject_application(gig_id: str, app_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.public_gigs.find_one({"_id": gig_id, "lead_id": current_user["id"]})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found or access denied")
    app = await db.public_gig_applications.find_one({"_id": app_id, "public_gig_id": gig_id, "status": "pending"})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    await db.public_gig_applications.update_one(
        {"_id": app_id},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await send_notification(
        db, app["applicant_id"], "rejected",
        "Application Update",
        f"Your application for {app['role_name']} in '{gig['title']}' was not selected this time. Keep applying!",
        {"public_gig_id": gig_id}
    )
    return {"status": "rejected"}


@router.put("/{gig_id}/cancel")
async def cancel_public_gig(gig_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.public_gigs.find_one({"_id": gig_id, "lead_id": current_user["id"]})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["status"] in ("filled", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot cancel this gig")
    await db.public_gigs.update_one(
        {"_id": gig_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "cancelled"}
