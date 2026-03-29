from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from db import get_db
from auth_utils import get_current_user, _clean_user
from services.notifications_service import send_notification
from services.whatsapp_mock import send_gig_invite_whatsapp
from services.email_service import send_invite_email, send_booking_confirmed_email, send_gig_completed_email
from services.pdf_service import generate_contract_pdf

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


def _parse_dt(date_str: str, time_str: str) -> datetime | None:
    """Parse date + time strings into a timezone-aware datetime. Returns None on failure."""
    try:
        dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


async def _check_90min_buffer(db, freelancer_id: str, new_date: str, new_start: str, new_end: str) -> str | None:
    """
    Check if a new session conflicts (within 90-minute buffer) with freelancer's existing accepted sessions.
    Returns an error message string if conflict found, None otherwise.
    """
    new_s = _parse_dt(new_date, new_start)
    new_e = _parse_dt(new_date, new_end)
    if not new_s or not new_e:
        return None  # Can't validate — skip

    buffer = timedelta(minutes=90)
    # Get all accepted invites for this freelancer
    existing_invites = await db.gig_invites.find(
        {"freelancer_id": freelancer_id, "status": "accepted"}
    ).to_list(200)

    for inv in existing_invites:
        gig = await db.gigs.find_one({"_id": inv["gig_id"]})
        if not gig:
            continue
        session = next((s for s in gig.get("sessions", []) if s.get("id") == inv.get("session_id")), None)
        if not session:
            continue
        ex_s = _parse_dt(session.get("date", ""), session.get("start_time", ""))
        ex_e = _parse_dt(session.get("date", ""), session.get("end_time", ""))
        if not ex_s or not ex_e:
            continue
        # Check if new session overlaps within 90 min buffer
        if new_s < ex_e + buffer and new_e + buffer > ex_s:
            return (
                f"Freelancer has a session on {session['date']} from {session['start_time']} to {session['end_time']}. "
                f"A 90-minute buffer is required between sessions."
            )
    return None


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


class PaymentRecord(BaseModel):
    type: str  # advance | balance
    amount: float
    notes: Optional[str] = None


@router.get("/{gig_id}/ledger")
async def get_gig_ledger(gig_id: str, current_user: dict = Depends(get_current_user)):
    """Return financial ledger for a gig — all accepted invites with payment tracking."""
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the lead photographer can view the ledger")

    invites = await db.gig_invites.find(
        {"gig_id": gig_id, "status": "accepted"}
    ).to_list(50)

    result = []
    for inv in invites:
        freelancer = await db.users.find_one({"_id": inv["freelancer_id"]}, {"full_name": 1, "email": 1, "_id": 0})
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        advance_amount = inv.get("advance_amount", round(agreed * 0.5, 2))
        result.append({
            "invite_id": inv["_id"],
            "freelancer_id": inv["freelancer_id"],
            "freelancer_name": freelancer.get("full_name", "Unknown") if freelancer else "Unknown",
            "freelancer_email": freelancer.get("email", "") if freelancer else "",
            "role": inv.get("role", ""),
            "session_date": inv.get("session_date", ""),
            "agreed_fee": agreed,
            "advance_amount": advance_amount,
            "advance_paid": inv.get("advance_paid", False),
            "advance_paid_at": inv.get("advance_paid_at"),
            "balance_amount": round(agreed - advance_amount, 2),
            "balance_paid": inv.get("balance_paid", False),
            "balance_paid_at": inv.get("balance_paid_at"),
            "payment_notes": inv.get("payment_notes", ""),
        })

    total_fee = sum(r["agreed_fee"] for r in result)
    total_advance = sum(r["advance_amount"] for r in result)
    total_balance = sum(r["balance_amount"] for r in result)
    advance_paid_count = sum(1 for r in result if r["advance_paid"])
    balance_paid_count = sum(1 for r in result if r["balance_paid"])

    return {
        "entries": result,
        "summary": {
            "total_fee": total_fee,
            "total_advance": total_advance,
            "total_balance": total_balance,
            "advance_paid_count": advance_paid_count,
            "balance_paid_count": balance_paid_count,
            "team_size": len(result),
        }
    }


@router.post("/invites/{invite_id}/payment")
async def record_payment(invite_id: str, data: PaymentRecord, current_user: dict = Depends(get_current_user)):
    """Record an advance or balance payment for a gig invite."""
    db = get_db()
    if data.type not in ("advance", "balance"):
        raise HTTPException(status_code=400, detail="type must be advance or balance")

    invite = await db.gig_invites.find_one({"_id": invite_id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    gig = await db.gigs.find_one({"_id": invite["gig_id"]})
    if not gig or gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the lead photographer can record payments")

    now = datetime.now(timezone.utc).isoformat()
    if data.type == "advance":
        update = {
            "advance_paid": True,
            "advance_amount": data.amount,
            "advance_paid_at": now,
        }
        msg = f"Advance payment of ₹{data.amount:.0f} has been recorded for {gig['title']}."
    else:
        update = {
            "balance_paid": True,
            "balance_paid_at": now,
        }
        msg = f"Balance payment for {gig['title']} has been marked as settled."

    if data.notes:
        update["payment_notes"] = data.notes
    update["updated_at"] = now

    await db.gig_invites.update_one({"_id": invite_id}, {"$set": update})
    await send_notification(
        db, invite["freelancer_id"], "wallet_credit",
        "Payment Recorded", msg,
        {"gig_id": invite["gig_id"], "invite_id": invite_id}
    )
    return {"message": f"{data.type.capitalize()} payment recorded", "invite_id": invite_id}


class UpdateGigRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


@router.put("/{gig_id}")
async def update_gig(gig_id: str, data: UpdateGigRequest, current_user: dict = Depends(get_current_user)):
    """Edit gig title/description only. Existing session dates/times cannot be changed."""
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the lead photographer can edit this gig")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.title is not None:
        update["title"] = data.title.strip()
    if data.description is not None:
        update["description"] = data.description
    await db.gigs.update_one({"_id": gig_id}, {"$set": update})
    gig = await db.gigs.find_one({"_id": gig_id})
    return _gig_to_dict(gig)


@router.delete("/{gig_id}")
async def delete_gig(gig_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a gig — only allowed if no accepted invites exist."""
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the lead photographer can delete this gig")
    accepted = await db.gig_invites.count_documents({"gig_id": gig_id, "status": "accepted"})
    if accepted > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a gig with accepted crew members. Cancel invites first.")
    await db.gig_invites.delete_many({"gig_id": gig_id})
    await db.gigs.delete_one({"_id": gig_id})
    return {"message": "Gig deleted successfully"}


@router.post("/{gig_id}/sessions")
async def add_session(gig_id: str, data: GigSession, current_user: dict = Depends(get_current_user)):
    """Add a new session to an existing gig."""
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the lead photographer can add sessions")
    new_session = {"id": str(uuid.uuid4()), **data.model_dump()}
    await db.gigs.update_one(
        {"_id": gig_id},
        {"$push": {"sessions": new_session}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Session added", "session": new_session}


@router.delete("/{gig_id}/sessions/{session_id}")
async def delete_session(gig_id: str, session_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a session — only if no accepted invite exists for it."""
    db = get_db()
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if len(gig.get("sessions", [])) <= 1:
        raise HTTPException(status_code=400, detail="A gig must have at least one session")
    accepted = await db.gig_invites.count_documents({"gig_id": gig_id, "session_id": session_id, "status": "accepted"})
    if accepted > 0:
        raise HTTPException(status_code=400, detail="Cannot remove a session with an accepted crew member")
    await db.gigs.update_one(
        {"_id": gig_id},
        {"$pull": {"sessions": {"id": session_id}}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Session removed"}


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

    # 90-minute buffer check
    session = next((s for s in gig.get("sessions", []) if s.get("id") == data.session_id), None)
    if session:
        conflict = await _check_90min_buffer(
            db, data.freelancer_id,
            session.get("date", data.session_date),
            session.get("start_time", ""),
            session.get("end_time", ""),
        )
        if conflict:
            raise HTTPException(status_code=409, detail=f"Schedule conflict: {conflict}")

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
            gig["title"], data.proposed_fee, invite["_id"],
            user_id=freelancer["_id"],
        )

    # Send email notification (gracefully mocked if no API key)
    if freelancer.get("email"):
        import asyncio
        asyncio.create_task(send_invite_email(
            db, freelancer["email"], freelancer["full_name"],
            current_user["full_name"], gig["title"],
            data.proposed_fee, invite["_id"]
        ))

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

    # Map action verbs to canonical status strings
    _STATUS_MAP = {"accept": "accepted", "reject": "rejected", "counter": "counter_offered"}
    update = {"status": _STATUS_MAP.get(data.action, data.action), "updated_at": now_iso}
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

    # Email: booking confirmed
    if data.action == "accept":
        import asyncio
        freelancer = await db.users.find_one({"_id": current_user["id"]})
        if freelancer and freelancer.get("email"):
            agreed = update.get("agreed_fee") or invite.get("proposed_fee", 0)
            asyncio.create_task(send_booking_confirmed_email(
                db, freelancer["email"], freelancer["full_name"],
                invite["gig_title"], agreed
            ))

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
    # Email: gig completed to lead
    import asyncio
    lead = await db.users.find_one({"_id": gig["lead_photographer_id"]})
    if lead and lead.get("email"):
        asyncio.create_task(send_gig_completed_email(db, lead["email"], lead["full_name"], gig["title"]))

    return {"data_delivered": True}


@router.get("/invites/{invite_id}/contract")
async def download_contract(invite_id: str, current_user: dict = Depends(get_current_user)):
    """Generate and download a PDF contract for an accepted invite."""
    db = get_db()
    invite = await db.gig_invites.find_one({"_id": invite_id})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    # Only lead or freelancer can download
    uid = current_user["id"]
    if invite["lead_id"] != uid and invite["freelancer_id"] != uid:
        raise HTTPException(status_code=403, detail="Access denied")

    if invite["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Contract is only available for accepted invites")

    gig = await db.gigs.find_one({"_id": invite["gig_id"]})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")

    lead_user = await db.users.find_one({"_id": invite["lead_id"]}, {"password_hash": 0, "_id": 0})
    freelancer_user = await db.users.find_one({"_id": invite["freelancer_id"]}, {"password_hash": 0, "_id": 0})

    if not lead_user or not freelancer_user:
        raise HTTPException(status_code=404, detail="User data not found")

    invite_clean = dict(invite)
    invite_clean["id"] = str(invite_clean.pop("_id"))

    gig_clean = _gig_to_dict(dict(gig))

    pdf_bytes = generate_contract_pdf(gig_clean, invite_clean, lead_user, freelancer_user)

    safe_title = gig.get("title", "contract").replace(" ", "_")[:40]
    filename = f"crewbook_contract_{safe_title}_{invite_id[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
