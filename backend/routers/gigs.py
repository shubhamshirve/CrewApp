from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from db import get_db
from auth_utils import get_current_user, _clean_user
from services.notifications_service import send_notification
from services.whatsapp_mock import send_gig_invite_whatsapp

router = APIRouter(prefix="/gigs")

EVENT_TYPES = ["Haldi", "Mehendi", "Sangam", "Sangeet", "Baraat", "Wedding", "Reception", "Pre-Wedding Shoot", "Corporate", "Birthday", "Other"]


class GigSession(BaseModel):
    date: str
    start_time: str
    end_time: str
    location: str
    venue_name: Optional[str] = None
    event_type: str


class CreateGigRequest(BaseModel):
    title: str
    description: Optional[str] = None
    sessions: List[GigSession]


class InviteRequest(BaseModel):
    freelancer_id: str
    session_id: str
    session_date: str
    role: str
    proposed_fee: float
    notes: Optional[str] = None


class InviteResponse(BaseModel):
    action: str  # accept / reject / counter
    counter_fee: Optional[float] = None
    message: Optional[str] = None


class WorkspaceFile(BaseModel):
    type: str  # moodboard, callsheet, location_pin, other
    title: str
    content: str  # URL, text, or base64


def _gig_to_dict(g: dict) -> dict:
    g = dict(g)
    if "_id" in g:
        g["id"] = str(g.pop("_id"))
    return g


@router.post("")
async def create_gig(data: CreateGigRequest, current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Only verified users can create gigs")
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    sessions = [{"id": str(uuid.uuid4()), **s.model_dump()} for s in data.sessions]
    gig = {
        "_id": str(uuid.uuid4()),
        "lead_photographer_id": current_user["id"],
        "lead_name": current_user["full_name"],
        "title": data.title,
        "description": data.description or "",
        "sessions": sessions,
        "status": "draft",
        "workspace_files": [],
        "data_delivered": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.gigs.insert_one(gig)
    return _gig_to_dict(gig)


@router.get("")
async def list_gigs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    uid = current_user["id"]
    gigs = await db.gigs.find({"lead_photographer_id": uid}).sort("created_at", -1).to_list(50)
    invite_gig_ids = await db.gig_invites.distinct("gig_id", {"freelancer_id": uid})
    freelancer_gigs = await db.gigs.find({"_id": {"$in": invite_gig_ids}}).to_list(50)
    all_gigs = {g["_id"]: g for g in gigs}
    for g in freelancer_gigs:
        all_gigs[g["_id"]] = g
    return [_gig_to_dict(g) for g in all_gigs.values()]


@router.get("/event-types")
async def get_event_types():
    return EVENT_TYPES


@router.get("/invites/received")
async def get_received_invites(current_user: dict = Depends(get_current_user)):
    db = get_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    # Auto-expire overdue invites
    await db.gig_invites.update_many(
        {"freelancer_id": current_user["id"], "status": "pending", "expires_at": {"$lt": now_iso}},
        {"$set": {"status": "expired"}}
    )
    invites = await db.gig_invites.find({"freelancer_id": current_user["id"]}).sort("created_at", -1).to_list(50)
    result = []
    for inv in invites:
        inv_dict = dict(inv)
        inv_dict["id"] = str(inv_dict.pop("_id"))
        gig = await db.gigs.find_one({"_id": inv_dict["gig_id"]})
        inv_dict["gig"] = _gig_to_dict(gig) if gig else None
        result.append(inv_dict)
    return result


@router.get("/{gig_id}")
async def get_gig(gig_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    gig_dict = _gig_to_dict(gig)
    invites = await db.gig_invites.find({"gig_id": gig_id}).to_list(50)
    invite_dicts = []
    for inv in invites:
        d = dict(inv)
        d["id"] = str(d.pop("_id"))
        freelancer = await db.users.find_one({"_id": d["freelancer_id"]}, {"password_hash": 0})
        d["freelancer"] = _clean_user(freelancer) if freelancer else None
        invite_dicts.append(d)
    gig_dict["invites"] = invite_dicts
    return gig_dict


@router.post("/{gig_id}/invites")
async def send_invite(gig_id: str, data: InviteRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id, "lead_photographer_id": current_user["id"]})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found or access denied")

    freelancer = await db.users.find_one({"_id": data.freelancer_id})
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    existing = await db.gig_invites.find_one({
        "gig_id": gig_id, "freelancer_id": data.freelancer_id,
        "session_id": data.session_id, "status": {"$in": ["pending", "accepted"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Invite already sent for this session")

    now = datetime.now(timezone.utc)
    invite = {
        "_id": str(uuid.uuid4()),
        "gig_id": gig_id,
        "gig_title": gig["title"],
        "session_id": data.session_id,
        "session_date": data.session_date,
        "lead_id": current_user["id"],
        "lead_name": current_user["full_name"],
        "freelancer_id": data.freelancer_id,
        "role": data.role,
        "proposed_fee": data.proposed_fee,
        "counter_fee": None,
        "agreed_fee": None,
        "notes": data.notes,
        "status": "pending",
        "expires_at": (now + timedelta(hours=24)).isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.gig_invites.insert_one(invite)

    await send_notification(
        db, data.freelancer_id, "invite",
        f"New Gig Invite: {gig['title']}",
        f"{current_user['full_name']} invited you as {data.role} for ₹{data.proposed_fee:.0f}",
        {"invite_id": invite["_id"], "gig_id": gig_id}
    )

    if freelancer.get("whatsapp_enabled") and freelancer.get("phone"):
        await send_gig_invite_whatsapp(
            db, freelancer["phone"], freelancer["full_name"],
            gig["title"], data.proposed_fee, invite["_id"]
        )

    invite["id"] = invite.pop("_id")
    return invite


@router.put("/invites/{invite_id}/respond")
async def respond_to_invite(invite_id: str, data: InviteResponse, current_user: dict = Depends(get_current_user)):
    db = get_db()
    invite = await db.gig_invites.find_one({"_id": invite_id, "freelancer_id": current_user["id"]})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["status"] not in ("pending", "counter_offered"):
        raise HTTPException(status_code=400, detail=f"Invite is already {invite['status']}")

    now_iso = datetime.now(timezone.utc).isoformat()
    if invite["expires_at"] < now_iso and invite["status"] == "pending":
        await db.gig_invites.update_one({"_id": invite_id}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invite has expired")

    update = {"status": data.action, "updated_at": now_iso}
    if data.action == "counter" and data.counter_fee:
        update["status"] = "counter_offered"
        update["counter_fee"] = data.counter_fee
    elif data.action == "accept":
        fee = invite.get("counter_fee") or invite["proposed_fee"]
        update["agreed_fee"] = fee
        await db.gigs.update_one({"_id": invite["gig_id"]}, {"$set": {"status": "active"}})

    await db.gig_invites.update_one({"_id": invite_id}, {"$set": update})

    notif_type = "accepted" if data.action == "accept" else ("counter" if data.action == "counter" else "rejected")
    msg_map = {
        "accept": f"{current_user['full_name']} accepted your invite for {invite['gig_title']}",
        "reject": f"{current_user['full_name']} declined your invite for {invite['gig_title']}",
        "counter": f"{current_user['full_name']} sent a counter-offer of ₹{data.counter_fee} for {invite['gig_title']}",
    }
    await send_notification(db, invite["lead_id"], notif_type, f"Invite {notif_type.title()}", msg_map.get(data.action, ""), {"invite_id": invite_id})
    return {"status": update["status"]}


@router.put("/invites/{invite_id}/lead-accept-counter")
async def lead_accept_counter(invite_id: str, current_user: dict = Depends(get_current_user)):
    """Lead photographer accepts a counter-offer."""
    db = get_db()
    invite = await db.gig_invites.find_one({"_id": invite_id, "lead_id": current_user["id"]})
    if not invite or invite["status"] != "counter_offered":
        raise HTTPException(status_code=404, detail="Counter offer not found")
    now_iso = datetime.now(timezone.utc).isoformat()
    agreed_fee = invite["counter_fee"]
    await db.gig_invites.update_one(
        {"_id": invite_id},
        {"$set": {"status": "accepted", "agreed_fee": agreed_fee, "updated_at": now_iso}}
    )
    await db.gigs.update_one({"_id": invite["gig_id"]}, {"$set": {"status": "active"}})
    await send_notification(
        db, invite["freelancer_id"], "accepted",
        "Counter-Offer Accepted!", f"Your counter of ₹{agreed_fee} was accepted for {invite['gig_title']}",
        {"invite_id": invite_id}
    )
    return {"status": "accepted", "agreed_fee": agreed_fee}


@router.post("/{gig_id}/workspace")
async def add_workspace_file(gig_id: str, data: WorkspaceFile, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    uid = current_user["id"]
    invite = await db.gig_invites.find_one({"gig_id": gig_id, "freelancer_id": uid, "status": "accepted"})
    if gig["lead_photographer_id"] != uid and not invite:
        raise HTTPException(status_code=403, detail="Not a member of this gig")
    file_item = {"id": str(uuid.uuid4()), **data.model_dump(), "added_by": uid, "added_at": datetime.now(timezone.utc).isoformat()}
    await db.gigs.update_one({"_id": gig_id}, {"$push": {"workspace_files": file_item}})
    return file_item


@router.put("/{gig_id}/handover")
async def mark_data_delivered(gig_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    invite = await db.gig_invites.find_one({"gig_id": gig_id, "freelancer_id": current_user["id"], "status": "accepted"})
    if not invite:
        raise HTTPException(status_code=403, detail="You are not part of this gig")
    now = datetime.now(timezone.utc).isoformat()
    await db.gigs.update_one(
        {"_id": gig_id},
        {"$set": {"data_delivered": True, "data_delivered_at": now, "status": "completed", "updated_at": now}}
    )
    gig = await db.gigs.find_one({"_id": gig_id})
    await send_notification(
        db, gig["lead_photographer_id"], "data_delivered",
        "Data Delivered!", f"{current_user['full_name']} has marked data as delivered for {gig['title']}",
        {"gig_id": gig_id}
    )
    return {"data_delivered": True}
