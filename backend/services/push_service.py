"""
Web Push Notification Service (VAPID).
Sends push notifications to subscribed browsers.
"""
import os
import json
import logging
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:support@photoo.in")


async def send_push_to_user(db, user_id: str, title: str, body: str, url: str = "/notifications"):
    """Send a web push notification to all subscriptions of a user."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
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
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
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
