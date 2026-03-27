"""
Mock WhatsApp Business API service.
Simulates sending WhatsApp messages by logging them and storing in DB.
Replace with real Meta WhatsApp Cloud API when credentials are available.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def send_whatsapp_message(db, phone: str, message: str, msg_type: str = "notification", buttons: list = None):
    record = {
        "_id": str(uuid.uuid4()),
        "phone": phone,
        "message": message,
        "type": msg_type,
        "buttons": buttons or [],
        "simulated": True,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.whatsapp_logs.insert_one(record)
    logger.info(f"[WhatsApp MOCK] To: {phone} | Type: {msg_type} | Msg: {message[:80]}")
    return {"status": "simulated", "message_id": record["_id"]}


async def send_gig_invite_whatsapp(db, phone: str, freelancer_name: str, gig_title: str, fee: float, invite_id: str):
    message = (
        f"Hi {freelancer_name}! You have a new gig invite for '{gig_title}'. "
        f"Proposed fee: ₹{fee:.0f}. "
        f"Reply ACCEPT_{invite_id} or REJECT_{invite_id}"
    )
    buttons = [
        {"type": "reply", "id": f"ACCEPT_{invite_id}", "title": "Accept"},
        {"type": "reply", "id": f"REJECT_{invite_id}", "title": "Reject"},
    ]
    return await send_whatsapp_message(db, phone, message, "gig_invite", buttons)


async def send_sunday_dispatch(db, phone: str, user_name: str, gigs_summary: list):
    if not gigs_summary:
        message = f"Hi {user_name}! No confirmed gigs next week. Stay ready!"
    else:
        lines = [f"Hi {user_name}! Your schedule for the upcoming week:"]
        for g in gigs_summary:
            lines.append(f"- {g['date']}: {g['title']} @ {g['location']}")
        message = "\n".join(lines)
    return await send_whatsapp_message(db, phone, message, "sunday_dispatch")
