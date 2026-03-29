"""
Platform Settings Router
Handles: pricing rules, event types, role categories, API keys
All GET endpoints are public; POST/PUT/DELETE require admin auth.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os

from db import get_db
from auth_utils import get_admin_user, get_current_user

router = APIRouter(prefix="/platform")

# ── Default seed data ────────────────────────────────────────────────────────

DEFAULT_SETTINGS = {
    "_id": "platform_settings",
    "referral_reward": 50,          # ₹ credited when referral subscribes
    "base_plan_price": 69,          # ₹/month
    "premium_plan_price": 99,       # ₹/month
    "base_plan_name": "Base Plan",
    "premium_plan_name": "Premium Plan",
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

DEFAULT_GEAR_CATALOGUE = [
    {"name": "Sony A7 IV", "category": "Camera", "brand": "Sony"},
    {"name": "Sony A7 III", "category": "Camera", "brand": "Sony"},
    {"name": "Sony A7S III", "category": "Camera", "brand": "Sony"},
    {"name": "Canon EOS R5", "category": "Camera", "brand": "Canon"},
    {"name": "Canon EOS R6", "category": "Camera", "brand": "Canon"},
    {"name": "Nikon Z6 II", "category": "Camera", "brand": "Nikon"},
    {"name": "Nikon Z7 II", "category": "Camera", "brand": "Nikon"},
    {"name": "Fujifilm X-T5", "category": "Camera", "brand": "Fujifilm"},
    {"name": "Sony 24-70mm f/2.8 GM", "category": "Lens", "brand": "Sony"},
    {"name": "Sony 70-200mm f/2.8 GM", "category": "Lens", "brand": "Sony"},
    {"name": "Canon RF 24-70mm f/2.8", "category": "Lens", "brand": "Canon"},
    {"name": "Sigma 35mm f/1.4 Art", "category": "Lens", "brand": "Sigma"},
    {"name": "Godox AD200 Pro", "category": "Lighting", "brand": "Godox"},
    {"name": "Godox AD600 Pro", "category": "Lighting", "brand": "Godox"},
    {"name": "Godox SL150 II", "category": "Lighting", "brand": "Godox"},
    {"name": "Profoto B10", "category": "Lighting", "brand": "Profoto"},
    {"name": "DJI Mavic 3 Pro", "category": "Drone", "brand": "DJI"},
    {"name": "DJI Mini 4 Pro", "category": "Drone", "brand": "DJI"},
    {"name": "DJI Air 3", "category": "Drone", "brand": "DJI"},
    {"name": "Rode VideoMic Pro+", "category": "Audio", "brand": "Rode"},
    {"name": "Zoom H5", "category": "Audio", "brand": "Zoom"},
    {"name": "DJI Mic 2", "category": "Audio", "brand": "DJI"},
    {"name": "Gitzo GT3543", "category": "Accessories", "brand": "Gitzo"},
    {"name": "Manfrotto 055", "category": "Accessories", "brand": "Manfrotto"},
    {"name": "Peak Design Capture", "category": "Accessories", "brand": "Peak Design"},
]

DEFAULT_EVENT_TYPES = [
    "Haldi", "Mehendi", "Sangeet", "Baraat", "Wedding",
    "Reception", "Pre-Wedding Shoot", "Corporate", "Birthday", "Other"
]

DEFAULT_ROLES = [
    "Lead Photographer", "Second Shooter", "Traditional Videographer",
    "Cinematic Videographer", "Drone Operator", "Photo Assistant",
    "Video Assistant", "Lighting Technician", "Photo Editor", "Video Editor"
]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_settings(db):
    doc = await db.platform_settings.find_one({"_id": "platform_settings"})
    if not doc:
        doc = DEFAULT_SETTINGS.copy()
        await db.platform_settings.insert_one(doc)
    return doc


async def _get_event_types(db) -> List[str]:
    doc = await db.platform_meta.find_one({"_id": "event_types"})
    if not doc:
        doc = {"_id": "event_types", "items": DEFAULT_EVENT_TYPES}
        await db.platform_meta.insert_one(doc)
    return doc.get("items", DEFAULT_EVENT_TYPES)


async def _get_roles(db) -> List[str]:
    doc = await db.platform_meta.find_one({"_id": "role_categories"})
    if not doc:
        doc = {"_id": "role_categories", "items": DEFAULT_ROLES}
        await db.platform_meta.insert_one(doc)
    return doc.get("items", DEFAULT_ROLES)


# ── Pricing Settings ─────────────────────────────────────────────────────────

@router.get("/settings")
async def get_platform_settings():
    """Public — return current pricing config."""
    db = get_db()
    doc = await _get_settings(db)
    return {
        "referral_reward": doc.get("referral_reward", DEFAULT_SETTINGS["referral_reward"]),
        "base_plan_price": doc.get("base_plan_price", DEFAULT_SETTINGS["base_plan_price"]),
        "premium_plan_price": doc.get("premium_plan_price", DEFAULT_SETTINGS["premium_plan_price"]),
        "base_plan_name": doc.get("base_plan_name", DEFAULT_SETTINGS["base_plan_name"]),
        "premium_plan_name": doc.get("premium_plan_name", DEFAULT_SETTINGS["premium_plan_name"]),
        "updated_at": doc.get("updated_at"),
    }


class PricingUpdateRequest(BaseModel):
    referral_reward: Optional[int] = None
    base_plan_price: Optional[int] = None
    premium_plan_price: Optional[int] = None
    base_plan_name: Optional[str] = None
    premium_plan_name: Optional[str] = None


@router.put("/settings")
async def update_platform_settings(
    data: PricingUpdateRequest,
    admin: dict = Depends(get_admin_user)
):
    """Admin — update pricing rules."""
    db = get_db()
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if data.referral_reward is not None:
        if data.referral_reward < 0:
            raise HTTPException(status_code=400, detail="Referral reward cannot be negative")
        update_fields["referral_reward"] = data.referral_reward

    if data.base_plan_price is not None:
        if data.base_plan_price < 1:
            raise HTTPException(status_code=400, detail="Base plan price must be at least ₹1")
        update_fields["base_plan_price"] = data.base_plan_price

    if data.premium_plan_price is not None:
        if data.premium_plan_price < 1:
            raise HTTPException(status_code=400, detail="Premium plan price must be at least ₹1")
        update_fields["premium_plan_price"] = data.premium_plan_price

    if data.base_plan_name is not None:
        update_fields["base_plan_name"] = data.base_plan_name.strip()

    if data.premium_plan_name is not None:
        update_fields["premium_plan_name"] = data.premium_plan_name.strip()

    await db.platform_settings.update_one(
        {"_id": "platform_settings"},
        {"$set": update_fields},
        upsert=True
    )
    return await get_platform_settings()


# ── Event Types ───────────────────────────────────────────────────────────────

@router.get("/event-types")
async def get_event_types():
    """Public — list all event types."""
    db = get_db()
    items = await _get_event_types(db)
    return {"event_types": items}


class EventTypeRequest(BaseModel):
    name: str


@router.post("/event-types")
async def add_event_type(data: EventTypeRequest, admin: dict = Depends(get_admin_user)):
    """Admin — add a new event type."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    db = get_db()
    items = await _get_event_types(db)
    if name in items:
        raise HTTPException(status_code=409, detail="Event type already exists")
    items.append(name)
    await db.platform_meta.update_one(
        {"_id": "event_types"},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"event_types": items}


@router.delete("/event-types/{name}")
async def remove_event_type(name: str, admin: dict = Depends(get_admin_user)):
    """Admin — remove an event type."""
    from urllib.parse import unquote
    name = unquote(name).strip()
    db = get_db()
    items = await _get_event_types(db)
    if name not in items:
        raise HTTPException(status_code=404, detail="Event type not found")
    items = [i for i in items if i != name]
    await db.platform_meta.update_one(
        {"_id": "event_types"},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"event_types": items}


# ── Role Categories ───────────────────────────────────────────────────────────

@router.get("/roles")
async def get_roles():
    """Public — list all professional roles."""
    db = get_db()
    items = await _get_roles(db)
    return {"roles": items}


class RoleRequest(BaseModel):
    name: str


@router.post("/roles")
async def add_role(data: RoleRequest, admin: dict = Depends(get_admin_user)):
    """Admin — add a new professional role."""
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    db = get_db()
    items = await _get_roles(db)
    if name in items:
        raise HTTPException(status_code=409, detail="Role already exists")
    items.append(name)
    await db.platform_meta.update_one(
        {"_id": "role_categories"},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"roles": items}


@router.delete("/roles/{name}")
async def remove_role(name: str, admin: dict = Depends(get_admin_user)):
    """Admin — remove a professional role."""
    from urllib.parse import unquote
    name = unquote(name).strip()
    db = get_db()
    items = await _get_roles(db)
    if name not in items:
        raise HTTPException(status_code=404, detail="Role not found")
    items = [i for i in items if i != name]
    await db.platform_meta.update_one(
        {"_id": "role_categories"},
        {"$set": {"items": items}},
        upsert=True
    )
    return {"roles": items}


# ── Gear Catalogue ────────────────────────────────────────────────────────────

async def _get_gear_catalogue(db):
    doc = await db.platform_meta.find_one({"_id": "gear_catalogue"})
    if not doc:
        import uuid as _uuid
        items = [{"id": str(_uuid.uuid4()), **g} for g in DEFAULT_GEAR_CATALOGUE]
        doc = {"_id": "gear_catalogue", "items": items}
        await db.platform_meta.insert_one(doc)
    return doc["items"]


@router.get("/gear-catalogue")
async def get_gear_catalogue():
    """Public — list master gear catalogue."""
    db = get_db()
    items = await _get_gear_catalogue(db)
    return {"items": items}


class GearCatalogueItem(BaseModel):
    name: str
    category: str
    brand: Optional[str] = None


@router.post("/gear-catalogue")
async def add_gear_catalogue_item(data: GearCatalogueItem, admin: dict = Depends(get_admin_user)):
    """Admin — add an item to master gear catalogue."""
    import uuid as _uuid
    db = get_db()
    items = await _get_gear_catalogue(db)
    new_item = {"id": str(_uuid.uuid4()), "name": data.name.strip(), "category": data.category, "brand": data.brand}
    items.append(new_item)
    await db.platform_meta.update_one({"_id": "gear_catalogue"}, {"$set": {"items": items}}, upsert=True)
    return {"items": items}


@router.delete("/gear-catalogue/{item_id}")
async def remove_gear_catalogue_item(item_id: str, admin: dict = Depends(get_admin_user)):
    """Admin — remove an item from master gear catalogue."""
    db = get_db()
    items = await _get_gear_catalogue(db)
    items = [i for i in items if i.get("id") != item_id]
    await db.platform_meta.update_one({"_id": "gear_catalogue"}, {"$set": {"items": items}}, upsert=True)
    return {"items": items}




# ── Custom Gear Submissions ───────────────────────────────────────────────────

class CustomGearSubmission(BaseModel):
    name: str
    category: str
    brand: Optional[str] = None


class ApproveGearSubmission(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None


@router.post("/gear-submissions")
async def submit_custom_gear(
    data: CustomGearSubmission,
    current_user: dict = Depends(get_current_user),
):
    """Authenticated user — submit a custom gear for admin review."""
    import uuid as _uuid
    db = get_db()
    submission = {
        "id": str(_uuid.uuid4()),
        "name": data.name.strip(),
        "category": data.category,
        "brand": data.brand,
        "submitted_by": current_user["id"],
        "submitted_by_name": current_user.get("full_name", "Unknown User"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_gear_submissions.insert_one({**submission, "_id": submission["id"]})
    return {k: v for k, v in submission.items()}


@router.get("/gear-submissions")
async def get_gear_submissions(admin: dict = Depends(get_admin_user)):
    """Admin — get all pending gear submissions."""
    db = get_db()
    cursor = db.custom_gear_submissions.find({"status": "pending"}, {"_id": 0})
    items = await cursor.to_list(length=200)
    return {"items": items}


@router.put("/gear-submissions/{submission_id}/approve")
async def approve_gear_submission(
    submission_id: str,
    data: ApproveGearSubmission,
    admin: dict = Depends(get_admin_user),
):
    """Admin — approve submission and add to master catalogue with optional field overrides."""
    import uuid as _uuid
    db = get_db()
    submission = await db.custom_gear_submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    name = (data.name or submission["name"]).strip()
    category = data.category or submission["category"]
    brand = data.brand if data.brand is not None else submission.get("brand")

    items = await _get_gear_catalogue(db)
    if any(i["name"].lower() == name.lower() for i in items):
        raise HTTPException(status_code=409, detail=f'"{name}" already exists in the catalogue')

    new_item = {"id": str(_uuid.uuid4()), "name": name, "category": category, "brand": brand}
    items.append(new_item)
    await db.platform_meta.update_one(
        {"_id": "gear_catalogue"}, {"$set": {"items": items}}, upsert=True
    )
    await db.custom_gear_submissions.update_one(
        {"id": submission_id}, {"$set": {"status": "approved"}}
    )
    return {"status": "approved", "added_item": new_item}


@router.delete("/gear-submissions/{submission_id}")
async def reject_gear_submission(submission_id: str, admin: dict = Depends(get_admin_user)):
    """Admin — reject a gear submission."""
    db = get_db()
    result = await db.custom_gear_submissions.update_one(
        {"id": submission_id}, {"$set": {"status": "rejected"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"status": "rejected"}


# ── API Keys / Integrations ───────────────────────────────────────────────────

# Keys we manage (each has a group and a list of field keys)
API_KEY_GROUPS = {
    "razorpay": {
        "label": "Razorpay Payments",
        "description": "Accept UPI & card payments for subscriptions",
        "fields": {
            "key_id": {"label": "Key ID", "secret": False},
            "key_secret": {"label": "Key Secret", "secret": True},
        }
    },
    "resend": {
        "label": "Resend Email",
        "description": "Send transactional emails to crew members",
        "fields": {
            "api_key": {"label": "API Key", "secret": True},
            "sender_email": {"label": "Sender Email", "secret": False},
        }
    },
    "whatsapp": {
        "label": "Meta WhatsApp Business",
        "description": "Send actionable gig alerts via WhatsApp",
        "fields": {
            "access_token": {"label": "Access Token", "secret": True},
            "phone_number_id": {"label": "Phone Number ID", "secret": False},
            "business_account_id": {"label": "Business Account ID", "secret": False},
        }
    },
    "google_calendar": {
        "label": "Google Calendar",
        "description": "Two-way sync for gig sessions & availability",
        "fields": {
            "client_id": {"label": "Client ID", "secret": False},
            "client_secret": {"label": "Client Secret", "secret": True},
        }
    },
    "ai": {
        "label": "AI / LLM (Gemini)",
        "description": "AI-powered crew suggestions & gig checklists",
        "fields": {
            "emergent_llm_key": {"label": "Emergent LLM Key", "secret": True},
        }
    },
}


def _mask_value(val: str) -> str:
    """Mask secret string: show first 4 + **** + last 4."""
    if not val:
        return ""
    if len(val) <= 8:
        return "****"
    return val[:4] + "****" + val[-4:]


async def _get_api_keys(db) -> dict:
    doc = await db.platform_secrets.find_one({"_id": "api_keys"}, {"_id": 0})
    return doc or {}


@router.get("/api-keys")
async def get_api_keys(admin: dict = Depends(get_admin_user)):
    """Admin — return masked API keys with configuration status."""
    db = get_db()
    stored = await _get_api_keys(db)

    result = {}
    for group_key, group_meta in API_KEY_GROUPS.items():
        fields_out = {}
        group_stored = stored.get(group_key, {})

        # For the AI group, seed from env if not in DB
        if group_key == "ai" and not group_stored.get("emergent_llm_key"):
            env_key = os.environ.get("EMERGENT_LLM_KEY", "")
            if env_key:
                group_stored = {"emergent_llm_key": env_key}

        for field_key, field_meta in group_meta["fields"].items():
            raw = group_stored.get(field_key, "")
            fields_out[field_key] = {
                "label": field_meta["label"],
                "value": _mask_value(raw) if (field_meta["secret"] and raw) else raw,
                "is_configured": bool(raw),
                "secret": field_meta["secret"],
            }

        all_configured = all(f["is_configured"] for f in fields_out.values())
        result[group_key] = {
            "label": group_meta["label"],
            "description": group_meta["description"],
            "fields": fields_out,
            "is_active": all_configured,
        }

    return result


class ApiKeyFieldUpdate(BaseModel):
    group: str
    field: str
    value: str


@router.put("/api-keys")
async def update_api_key(
    data: ApiKeyFieldUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Admin — update a single API key field."""
    if data.group not in API_KEY_GROUPS:
        raise HTTPException(status_code=400, detail=f"Unknown group: {data.group}")
    if data.field not in API_KEY_GROUPS[data.group]["fields"]:
        raise HTTPException(status_code=400, detail=f"Unknown field: {data.field}")

    db = get_db()
    await db.platform_secrets.update_one(
        {"_id": "api_keys"},
        {"$set": {f"{data.group}.{data.field}": data.value.strip(),
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok", "group": data.group, "field": data.field, "is_configured": bool(data.value.strip())}
