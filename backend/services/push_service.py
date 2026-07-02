"""
Web Push Notification Service (VAPID).
Sends push notifications to subscribed browsers.
Reads VAPID keys from platform_secrets DB first, then falls back to environment variables.
"""
import os
import json
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


async def _get_vapid_keys(db) -> tuple[str, str, str]:
    """
    Resolve VAPID keys: DB (platform_secrets.api_keys.vapid.*) takes priority,
    then falls back to VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT env vars.
    Returns (public_key, private_key, subject).
    """
    doc = await db.platform_secrets.find_one({"_id": "api_keys"}, {"_id": 0})
    stored = (doc or {}).get("vapid", {})

    public_key = stored.get("public_key") or os.environ.get("VAPID_PUBLIC_KEY", "")
    private_key = stored.get("private_key") or os.environ.get("VAPID_PRIVATE_KEY", "")
    subject = stored.get("subject") or os.environ.get("VAPID_SUBJECT", "mailto:support@photoo.in")
    return public_key, private_key, subject


async def send_push_to_user(db, user_id: str, title: str, body: str, url: str = "/notifications"):
    """Send a web push notification to all subscriptions of a user."""
    public_key, private_key, subject = await _get_vapid_keys(db)

    if not private_key or not public_key:
        logger.warning("VAPID keys not configured — skipping push notification")
        return

    subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(20)
    if not subscriptions:
        return

    payload = json.dumps({"title": title, "body": body, "url": url})
    expired_endpoints = []

    for sub in subscriptions:
        sub_info = {
            "endpoint": sub["endpoint"],
            "keys": {
                "auth": sub["auth"],
                "p256dh": sub["p256dh"],
            },
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": subject},
            )
        except WebPushException as e:
            err = str(e)
            logger.error(f"Push failed for {sub['endpoint'][:40]}…: {err}")
            # 410 = subscription expired/revoked — clean it up
            if "410" in err or "404" in err:
                expired_endpoints.append(sub["endpoint"])
        except Exception as e:
            logger.error(f"Unexpected push error: {e}")

    if expired_endpoints:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": expired_endpoints}})
