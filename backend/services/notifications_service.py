from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


async def send_notification(db, user_id: str, notif_type: str, title: str, message: str, data: dict = None):
    notif = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "data": data or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notif)
    return notif
