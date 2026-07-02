"""
Push Notification Subscription Management.
Stores/removes browser push subscriptions per user.
"""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/push")


class PushSubscribeRequest(BaseModel):
    endpoint: str
    auth: str
    p256dh: str
    user_agent: str = ""


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return VAPID public key for frontend subscription.
    Reads from platform_secrets DB first, then falls back to VAPID_PUBLIC_KEY env var.
    """
    db = get_db()
    doc = await db.platform_secrets.find_one({"_id": "api_keys"}, {"_id": 0})
    stored = doc or {}
    key = stored.get("vapid", {}).get("public_key", "") or os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"vapid_public_key": key}


@router.post("/subscribe")
async def subscribe(data: PushSubscribeRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Upsert by endpoint
    existing = await db.push_subscriptions.find_one({"endpoint": data.endpoint})
    now = datetime.now(timezone.utc).isoformat()

    if existing:
        await db.push_subscriptions.update_one(
            {"endpoint": data.endpoint},
            {"$set": {
                "user_id": current_user["id"],
                "auth": data.auth,
                "p256dh": data.p256dh,
                "user_agent": data.user_agent,
                "updated_at": now,
            }},
        )
        return {"status": "updated"}

    await db.push_subscriptions.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "endpoint": data.endpoint,
        "auth": data.auth,
        "p256dh": data.p256dh,
        "user_agent": data.user_agent,
        "created_at": now,
        "updated_at": now,
    })
    return {"status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe(data: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    endpoint = data.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="endpoint required")
    await db.push_subscriptions.delete_many({"user_id": current_user["id"], "endpoint": endpoint})
    return {"status": "unsubscribed"}


@router.get("/status")
async def subscription_status(current_user: dict = Depends(get_current_user)):
    """Check if user has any active push subscriptions."""
    db = get_db()
    count = await db.push_subscriptions.count_documents({"user_id": current_user["id"]})
    return {"subscribed": count > 0, "count": count}
