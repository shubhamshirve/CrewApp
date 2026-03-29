"""
Private Lead Notes Router
Allows lead photographers to keep private notes about freelancers.
Notes are only visible to the note author (lead_id = current user).
IMPORTANT: Notes can only be created/read for connected users.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/notes")


class NoteUpsert(BaseModel):
    content: str


async def _check_connected(db, user_a_id: str, user_b_id: str):
    """Raise 403 if user_a and user_b are not connected (accepted)."""
    conn = await db.connections.find_one({
        "$or": [
            {"requester_id": user_a_id, "recipient_id": user_b_id},
            {"requester_id": user_b_id, "recipient_id": user_a_id},
        ],
        "status": "accepted",
    })
    if not conn:
        raise HTTPException(status_code=403, detail="Private notes are only available for connected users.")


@router.get("/{freelancer_id}")
async def get_note(freelancer_id: str, current_user: dict = Depends(get_current_user)):
    """Get your private note about a freelancer. Returns empty if none exists."""
    db = get_db()
    await _check_connected(db, current_user["id"], freelancer_id)
    note = await db.lead_notes.find_one(
        {"lead_id": current_user["id"], "freelancer_id": freelancer_id},
        {"_id": 0}
    )
    if not note:
        return {"content": "", "freelancer_id": freelancer_id, "exists": False}
    return {**note, "exists": True}


@router.put("/{freelancer_id}")
async def upsert_note(freelancer_id: str, data: NoteUpsert, current_user: dict = Depends(get_current_user)):
    """Create or update your private note about a freelancer. Requires an accepted connection."""
    db = get_db()

    if freelancer_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot add notes about yourself")

    # Only connected users can leave notes
    await _check_connected(db, current_user["id"], freelancer_id)

    # Ensure the freelancer exists
    freelancer = await db.users.find_one({"_id": freelancer_id}, {"_id": 1})
    if not freelancer:
        raise HTTPException(status_code=404, detail="Freelancer not found")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.lead_notes.find_one(
        {"lead_id": current_user["id"], "freelancer_id": freelancer_id}
    )

    if existing:
        await db.lead_notes.update_one(
            {"lead_id": current_user["id"], "freelancer_id": freelancer_id},
            {"$set": {"content": data.content, "updated_at": now}}
        )
    else:
        await db.lead_notes.insert_one({
            "_id": str(uuid.uuid4()),
            "lead_id": current_user["id"],
            "freelancer_id": freelancer_id,
            "content": data.content,
            "created_at": now,
            "updated_at": now,
        })

    return {
        "lead_id": current_user["id"],
        "freelancer_id": freelancer_id,
        "content": data.content,
        "updated_at": now,
        "exists": True,
    }


@router.delete("/{freelancer_id}")
async def delete_note(freelancer_id: str, current_user: dict = Depends(get_current_user)):
    """Delete your private note about a freelancer."""
    db = get_db()
    result = await db.lead_notes.delete_one(
        {"lead_id": current_user["id"], "freelancer_id": freelancer_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "message": "Note deleted"}
