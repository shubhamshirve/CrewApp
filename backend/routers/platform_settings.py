"""
Platform Settings Router
Handles: pricing rules, event types, role categories
All GET endpoints are public; POST/PUT/DELETE require admin auth.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from db import get_db
from auth_utils import get_admin_user

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
