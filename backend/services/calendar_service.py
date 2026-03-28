"""
Google Calendar Sync Service (MOCKED)
Simulates Google Calendar two-way sync. 
Replace with real Google Calendar API when OAuth credentials are available.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def connect_google_calendar(db, user_id: str, auth_code: str = None) -> dict:
    """Mock: Connect a user's Google Calendar."""
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": "connect",
        "auth_code": auth_code,
        "status": "simulated",
        "simulated": True,
        "created_at": now,
    }
    await db.calendar_sync_logs.insert_one(record)
    # Store connection status in user record
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"google_calendar_connected": True, "google_calendar_connected_at": now}}
    )
    logger.info(f"[Calendar MOCK] Connected Google Calendar for user: {user_id}")
    return {"status": "connected", "simulated": True}


async def disconnect_google_calendar(db, user_id: str) -> dict:
    """Mock: Disconnect a user's Google Calendar."""
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"google_calendar_connected": False, "google_calendar_connected_at": now}}
    )
    logger.info(f"[Calendar MOCK] Disconnected Google Calendar for user: {user_id}")
    return {"status": "disconnected", "simulated": True}


async def sync_gig_to_calendar(db, user_id: str, gig: dict, session: dict) -> dict:
    """Mock: Sync a gig session to Google Calendar."""
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "gig_id": gig.get("id") or gig.get("_id"),
        "session_id": session.get("id"),
        "event_title": f"{gig.get('title')} – {session.get('event_type')}",
        "event_date": session.get("date"),
        "start_time": session.get("start_time"),
        "end_time": session.get("end_time"),
        "location": session.get("location"),
        "action": "sync",
        "status": "simulated",
        "simulated": True,
        "created_at": now,
    }
    await db.calendar_sync_logs.insert_one(record)
    logger.info(f"[Calendar MOCK] Synced event '{record['event_title']}' for user: {user_id}")
    return {"status": "synced", "event_id": record["_id"], "simulated": True}
