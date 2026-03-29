from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


def _get_notification_url(notif_type: str, data: dict) -> str:
    """Map notification type + data to the correct frontend route."""
    d = data or {}
    gig_id = d.get("gig_id")
    profile_id = d.get("profile_id") or d.get("user_id")

    if notif_type in ("invite", "accepted", "rejected", "counter", "data_delivered"):
        return f"/gigs/{gig_id}" if gig_id else "/gigs"

    if notif_type in ("connection_request", "connection_accepted"):
        return f"/profile/{profile_id}" if profile_id else "/connections"

    if notif_type in ("wallet_credit", "subscription"):
        return "/wallet"

    if notif_type in ("verification", "penalty"):
        return "/dashboard"

    # admin_broadcast, fallback
    return "/notifications"


async def send_notification(db, user_id: str, notif_type: str, title: str, message: str, data: dict = None):
    url = _get_notification_url(notif_type, data)
    notif = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "data": data or {},
        "url": url,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(notif)

    # Fire-and-forget push notification (with deep-link URL)
    try:
        from services.push_service import send_push_to_user
        await send_push_to_user(db, user_id, title, message, url)
    except Exception as e:
        logger.warning(f"Push notification failed (non-critical): {e}")

    return notif
