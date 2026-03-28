"""
Google Calendar Sync Router
Endpoints for connecting/disconnecting Google Calendar and checking sync status.
Currently MOCKED — ready for real OAuth integration.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from db import get_db
from auth_utils import get_current_user
from services.calendar_service import connect_google_calendar, disconnect_google_calendar

router = APIRouter(prefix="/calendar")


class CalendarConnectRequest(BaseModel):
    auth_code: Optional[str] = None


@router.get("/status")
async def get_calendar_status(current_user: dict = Depends(get_current_user)):
    """Get the user's Google Calendar connection status."""
    db = get_db()
    user = await db.users.find_one({"_id": current_user["id"]}, {"_id": 0, "google_calendar_connected": 1, "google_calendar_connected_at": 1})
    return {
        "connected": user.get("google_calendar_connected", False),
        "connected_at": user.get("google_calendar_connected_at"),
        "simulated": True,
        "note": "Google Calendar sync is currently in preview mode. Real sync coming soon.",
    }


@router.post("/connect")
async def connect_calendar(data: CalendarConnectRequest = None, current_user: dict = Depends(get_current_user)):
    """Connect user's Google Calendar (mocked)."""
    db = get_db()
    result = await connect_google_calendar(db, current_user["id"], auth_code=data.auth_code if data else None)
    return result


@router.post("/disconnect")
async def disconnect_calendar(current_user: dict = Depends(get_current_user)):
    """Disconnect user's Google Calendar (mocked)."""
    db = get_db()
    result = await disconnect_google_calendar(db, current_user["id"])
    return result


@router.get("/sync-logs")
async def get_sync_logs(current_user: dict = Depends(get_current_user)):
    """Get recent calendar sync activity."""
    db = get_db()
    logs = await db.calendar_sync_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"logs": logs}
