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

    # Fire-and-forget push notification
    try:
        from services.push_service import send_push_to_user
        await send_push_to_user(db, user_id, title, message)
    except Exception as e:
        logger.warning(f"Push notification failed (non-critical): {e}")

    return notif
