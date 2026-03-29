"""
Mock WhatsApp Business API service.
Simulates sending WhatsApp messages by logging them and storing in DB.
Replace with real Meta WhatsApp Cloud API when credentials are available.
Only sends to users whose active plan has whatsapp_enabled = True.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def _user_has_whatsapp(db, user_id: str) -> bool:
    """Check if user's active plan enables WhatsApp notifications. Admins always have access."""
    if not user_id:
        return False
    user = await db.users.find_one(
        {"_id": user_id},
        {"_id": 0, "active_plan_features": 1, "whatsapp_enabled": 1, "is_admin": 1}
    )
    if not user:
        return False
    if user.get("is_admin"):
        return True
    features = user.get("active_plan_features") or {}
    if features:
        return bool(features.get("whatsapp_enabled", False))
    # Legacy fallback
    return bool(user.get("whatsapp_enabled", False))


async def send_whatsapp_message(
    db,
    phone: str,
    message: str,
    msg_type: str = "notification",
    buttons: list = None,
    user_id: str = None,
):
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "phone": phone,
        "message": message,
        "type": msg_type,
        "template": msg_type,
        "buttons": buttons or [],
        "status": "sent",
        "simulated": True,
        "sent_at": now,
        "created_at": now,
    }
    await db.whatsapp_logs.insert_one(record)
    logger.info(f"[WhatsApp MOCK] To: {phone} | Type: {msg_type} | Msg: {message[:80]}")
    return {"status": "simulated", "message_id": record["_id"]}


async def send_gig_invite_whatsapp(
    db, phone: str, freelancer_name: str, gig_title: str,
    fee: float, invite_id: str, user_id: str = None,
):
    if not await _user_has_whatsapp(db, user_id):
        logger.info(f"[WhatsApp] Skipped (no plan access) for user {user_id}")
        return {"status": "skipped", "reason": "whatsapp_not_enabled_on_plan"}
    message = (
        f"Hi {freelancer_name}! You have a new gig invite for '{gig_title}'. "
        f"Proposed fee: ₹{fee:.0f}. "
        f"Reply ACCEPT_{invite_id} or REJECT_{invite_id}"
    )
    buttons = [
        {"type": "reply", "id": f"ACCEPT_{invite_id}", "title": "Accept"},
        {"type": "reply", "id": f"REJECT_{invite_id}", "title": "Reject"},
    ]
    return await send_whatsapp_message(db, phone, message, "gig_invite", buttons, user_id=user_id)


async def send_sunday_dispatch(db, phone: str, user_name: str, gigs_summary: list, user_id: str = None):
    if not await _user_has_whatsapp(db, user_id):
        logger.info(f"[WhatsApp] Skipped dispatch (no plan access) for user {user_id}")
        return {"status": "skipped", "reason": "whatsapp_not_enabled_on_plan"}
    if not gigs_summary:
        message = f"Hi {user_name}! No confirmed gigs next week. Stay ready!"
    else:
        lines = [f"Hi {user_name}! Your schedule for the upcoming week:"]
        for g in gigs_summary:
            lines.append(f"- {g['date']}: {g['title']} @ {g['location']}")
        message = "\n".join(lines)
    return await send_whatsapp_message(db, phone, message, "sunday_dispatch", user_id=user_id)
