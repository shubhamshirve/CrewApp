# backend/services/log_service.py
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def log_admin_action(
    db,
    admin: dict,
    action: str,
    target_type: str,
    target_id: str,
    before: dict,
    after: dict,
) -> None:
    """Fire-and-forget admin audit log. Never raises."""
    try:
        await db.admin_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "admin_id": admin["id"],
            "admin_email": admin.get("email", ""),
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id),
            "before": before,
            "after": after,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.error("Failed to write admin_log action=%s: %s", action, exc)
