"""
Notification Templates Router
Admin CRUD for managing platform notification templates.
Templates are mapped to: in-app notifications, WhatsApp, and Email events.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/templates")

# Predefined event types that the platform supports
PLATFORM_EVENT_TYPES = [
    {
        "event_type": "invite_sent",
        "label": "Gig Invite Sent",
        "description": "Sent when a lead photographer invites a freelancer to a gig",
        "variables": ["freelancer_name", "lead_name", "gig_title", "fee", "invite_id"],
    },
    {
        "event_type": "booking_confirmed",
        "label": "Booking Confirmed",
        "description": "Sent when an invite is accepted and booking is confirmed",
        "variables": ["freelancer_name", "lead_name", "gig_title", "agreed_fee"],
    },
    {
        "event_type": "counter_offer",
        "label": "Counter Offer Received",
        "description": "Sent when a freelancer sends a counter-offer",
        "variables": ["lead_name", "freelancer_name", "gig_title", "counter_fee"],
    },
    {
        "event_type": "invite_rejected",
        "label": "Invite Rejected",
        "description": "Sent when a freelancer rejects an invite",
        "variables": ["lead_name", "freelancer_name", "gig_title"],
    },
    {
        "event_type": "payment_received",
        "label": "Payment Received",
        "description": "Sent when a wallet payment or subscription is processed",
        "variables": ["user_name", "amount", "plan_name", "transaction_id"],
    },
    {
        "event_type": "gig_completed",
        "label": "Gig Completed",
        "description": "Sent when a gig is marked as completed / data delivered",
        "variables": ["lead_name", "freelancer_name", "gig_title"],
    },
    {
        "event_type": "rating_request",
        "label": "Rating Request",
        "description": "Sent post-event to request crew ratings",
        "variables": ["user_name", "gig_title", "rate_link"],
    },
    {
        "event_type": "sunday_dispatch",
        "label": "Sunday Weekly Dispatch",
        "description": "Weekly schedule digest sent every Sunday",
        "variables": ["user_name", "schedule_summary"],
    },
    {
        "event_type": "verification_approved",
        "label": "ID Verification Approved",
        "description": "Sent when admin approves a user's ID verification",
        "variables": ["user_name"],
    },
    {
        "event_type": "verification_rejected",
        "label": "ID Verification Rejected",
        "description": "Sent when admin rejects a user's ID verification",
        "variables": ["user_name", "reason"],
    },
    {
        "event_type": "penalty_issued",
        "label": "Penalty Issued",
        "description": "Sent when an admin issues a penalty to a user",
        "variables": ["user_name", "reason", "penalty_level"],
    },
    {
        "event_type": "connection_request",
        "label": "Connection Request",
        "description": "Sent when someone sends a connection request",
        "variables": ["recipient_name", "sender_name"],
    },
]


class TemplateUpsert(BaseModel):
    event_type: Optional[str] = None  # Ignored; event_type comes from URL path
    platform_message: Optional[str] = None
    whatsapp_template_name: Optional[str] = None
    whatsapp_language_code: Optional[str] = "en"
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    is_active: bool = True


def _admin_required(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/event-types")
async def get_event_types(_=Depends(_admin_required)):
    """Return all supported platform event types with metadata."""
    return {"event_types": PLATFORM_EVENT_TYPES}


@router.get("")
async def list_templates(_=Depends(_admin_required)):
    """List all saved templates. Merges with event type definitions."""
    db = get_db()
    saved = await db.notification_templates.find({}, {"_id": 0}).to_list(100)
    saved_map = {t["event_type"]: t for t in saved}

    result = []
    for et in PLATFORM_EVENT_TYPES:
        tmpl = saved_map.get(et["event_type"], {})
        result.append({
            "event_type": et["event_type"],
            "label": et["label"],
            "description": et["description"],
            "variables": et["variables"],
            "platform_message": tmpl.get("platform_message", ""),
            "whatsapp_template_name": tmpl.get("whatsapp_template_name", ""),
            "whatsapp_language_code": tmpl.get("whatsapp_language_code", "en"),
            "email_subject": tmpl.get("email_subject", ""),
            "email_body": tmpl.get("email_body", ""),
            "is_active": tmpl.get("is_active", True),
            "updated_at": tmpl.get("updated_at"),
            "has_saved": bool(tmpl),
        })
    return {"templates": result}


@router.put("/{event_type}")
async def upsert_template(event_type: str, data: TemplateUpsert, _=Depends(_admin_required)):
    """Create or update a notification template for an event type."""
    db = get_db()

    # Validate event type
    valid_types = {et["event_type"] for et in PLATFORM_EVENT_TYPES}
    if event_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Unknown event type: {event_type}")

    now = datetime.now(timezone.utc).isoformat()
    template_doc = {
        "event_type": event_type,
        "platform_message": data.platform_message or "",
        "whatsapp_template_name": data.whatsapp_template_name or "",
        "whatsapp_language_code": data.whatsapp_language_code or "en",
        "email_subject": data.email_subject or "",
        "email_body": data.email_body or "",
        "is_active": data.is_active,
        "updated_at": now,
    }

    existing = await db.notification_templates.find_one({"event_type": event_type})
    if existing:
        await db.notification_templates.update_one(
            {"event_type": event_type},
            {"$set": template_doc}
        )
    else:
        template_doc["created_at"] = now
        await db.notification_templates.insert_one({**template_doc, "_id": str(uuid.uuid4())})

    return {"success": True, "template": template_doc}


@router.delete("/{event_type}")
async def delete_template(event_type: str, _=Depends(_admin_required)):
    """Remove a saved template (resets to defaults)."""
    db = get_db()
    result = await db.notification_templates.delete_one({"event_type": event_type})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True, "message": f"Template for {event_type} reset to default"}


@router.get("/{event_type}")
async def get_template(event_type: str, _=Depends(_admin_required)):
    """Get a single template by event type."""
    db = get_db()
    tmpl = await db.notification_templates.find_one({"event_type": event_type}, {"_id": 0})
    if not tmpl:
        # Return defaults from event type definition
        et = next((e for e in PLATFORM_EVENT_TYPES if e["event_type"] == event_type), None)
        if not et:
            raise HTTPException(status_code=404, detail="Event type not found")
        return {
            "event_type": event_type,
            "label": et["label"],
            "variables": et["variables"],
            "platform_message": "",
            "whatsapp_template_name": "",
            "whatsapp_language_code": "en",
            "email_subject": "",
            "email_body": "",
            "is_active": True,
            "has_saved": False,
        }
    return tmpl
