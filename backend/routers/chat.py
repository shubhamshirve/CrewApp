from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/gigs")


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


async def _check_gig_member(db, gig_id: str, user_id: str) -> dict:
    """Returns gig if user is the lead or has an accepted invite. Raises 403 otherwise."""
    gig = await db.gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["lead_photographer_id"] == user_id:
        return gig
    invite = await db.gig_invites.find_one(
        {"gig_id": gig_id, "freelancer_id": user_id, "status": "accepted"}
    )
    if not invite:
        raise HTTPException(status_code=403, detail="Only gig members can access this chat")
    return gig


@router.get("/{gig_id}/messages")
async def get_messages(gig_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch the last 100 messages for a gig. Also returns unread count for the current user."""
    db = get_db()
    await _check_gig_member(db, gig_id, current_user["id"])

    messages = await db.gig_messages.find(
        {"gig_id": gig_id}
    ).sort("created_at", 1).to_list(100)

    result = []
    unread_count = 0
    for m in messages:
        m_dict = dict(m)
        m_dict["id"] = str(m_dict.pop("_id"))
        read_by = m_dict.get("read_by", [])
        is_mine = m_dict["sender_id"] == current_user["id"]
        if not is_mine and current_user["id"] not in read_by:
            unread_count += 1
        m_dict.pop("read_by", None)
        result.append(m_dict)

    return {"messages": result, "unread_count": unread_count}


@router.post("/{gig_id}/messages")
async def send_message(gig_id: str, data: SendMessageRequest, current_user: dict = Depends(get_current_user)):
    """Send a message to a gig chat."""
    db = get_db()
    await _check_gig_member(db, gig_id, current_user["id"])

    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "_id": str(uuid.uuid4()),
        "gig_id": gig_id,
        "sender_id": current_user["id"],
        "sender_name": current_user["full_name"],
        "content": data.content.strip(),
        "created_at": now,
        "read_by": [current_user["id"]],  # sender has already "read" their own message
    }
    await db.gig_messages.insert_one(msg)
    msg["id"] = msg.pop("_id")
    msg.pop("read_by", None)
    return msg


@router.put("/{gig_id}/messages/read")
async def mark_messages_read(gig_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all unread messages in this gig's chat as read for the current user."""
    db = get_db()
    await _check_gig_member(db, gig_id, current_user["id"])

    await db.gig_messages.update_many(
        {"gig_id": gig_id, "sender_id": {"$ne": current_user["id"]}, "read_by": {"$nin": [current_user["id"]]}},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"ok": True}
