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
import re
import logging

from db import get_db
from auth_utils import get_admin_user, get_current_user
from cache import get_cached, invalidate_cache

logger = logging.getLogger(__name__)

# Cache TTL: 5 minutes for event types/roles (rarely change)
_PLATFORM_TTL = 300

router = APIRouter(prefix="/platform")

# ── Default seed data ────────────────────────────────────────────────────────

DEFAULT_SETTINGS = {
    "_id": "platform_settings",
    "referral_reward": 50,
    "base_plan_price": 69,
    "premium_plan_price": 99,
    "base_plan_name": "Base Plan",
    "premium_plan_name": "Premium Plan",
    "ai_features_enabled": True,               # Legacy master flag — kept only as a fallback default for the granular toggles below
    "ai_crew_suggestions_enabled": True,        # AI crew suggestions on gig creation
    "ai_gig_checklist_enabled": True,           # AI-generated pre-event checklists
    "ai_gear_normalize_enabled": True,          # Real-time AI gear name normalization while typing
    "ai_gear_validation_enabled": True,         # AI validation/auto-approval of custom gear submissions
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

async def _load_settings_from_db(db):
    doc = await db.platform_settings.find_one({"_id": "platform_settings"})
    if not doc:
        doc = DEFAULT_SETTINGS.copy()
        await db.platform_settings.insert_one(doc)
    return doc


async def _load_event_types_from_db(db) -> List[str]:
    doc = await db.platform_meta.find_one({"_id": "event_types"})
    if not doc:
        doc = {"_id": "event_types", "items": DEFAULT_EVENT_TYPES}
        await db.platform_meta.insert_one(doc)
    return doc.get("items", DEFAULT_EVENT_TYPES)


async def _load_roles_from_db(db) -> List[str]:
    doc = await db.platform_meta.find_one({"_id": "role_categories"})
    if not doc:
        doc = {"_id": "role_categories", "items": DEFAULT_ROLES}
        await db.platform_meta.insert_one(doc)
    return doc.get("items", DEFAULT_ROLES)


async def _get_settings(db):
    """Cached platform settings (5-minute TTL)."""
    return await get_cached("platform_settings", lambda: _load_settings_from_db(db), ttl=_PLATFORM_TTL)


async def _get_event_types(db) -> List[str]:
    """Cached event types list (5-minute TTL)."""
    return await get_cached("event_types", lambda: _load_event_types_from_db(db), ttl=_PLATFORM_TTL)


async def _get_roles(db) -> List[str]:
    """Cached roles list (5-minute TTL)."""
    return await get_cached("role_categories", lambda: _load_roles_from_db(db), ttl=_PLATFORM_TTL)


# ── Pricing Settings ─────────────────────────────────────────────────────────

@router.get("/settings")
async def get_platform_settings():
    """Public — return current pricing config."""
    db = get_db()
    doc = await _get_settings(db)
    legacy_master = doc.get("ai_features_enabled", True)
    return {
        "referral_reward": doc.get("referral_reward", DEFAULT_SETTINGS["referral_reward"]),
        "base_plan_price": doc.get("base_plan_price", DEFAULT_SETTINGS["base_plan_price"]),
        "premium_plan_price": doc.get("premium_plan_price", DEFAULT_SETTINGS["premium_plan_price"]),
        "base_plan_name": doc.get("base_plan_name", DEFAULT_SETTINGS["base_plan_name"]),
        "premium_plan_name": doc.get("premium_plan_name", DEFAULT_SETTINGS["premium_plan_name"]),
        "ai_features_enabled": legacy_master,
        "ai_crew_suggestions_enabled": doc.get("ai_crew_suggestions_enabled", legacy_master),
        "ai_gig_checklist_enabled": doc.get("ai_gig_checklist_enabled", legacy_master),
        "ai_gear_normalize_enabled": doc.get("ai_gear_normalize_enabled", legacy_master),
        "ai_gear_validation_enabled": doc.get("ai_gear_validation_enabled", legacy_master),
        "updated_at": doc.get("updated_at"),
    }


class PricingUpdateRequest(BaseModel):
    referral_reward: Optional[int] = None
    base_plan_price: Optional[int] = None
    premium_plan_price: Optional[int] = None
    base_plan_name: Optional[str] = None
    premium_plan_name: Optional[str] = None
    ai_features_enabled: Optional[bool] = None
    ai_crew_suggestions_enabled: Optional[bool] = None
    ai_gig_checklist_enabled: Optional[bool] = None
    ai_gear_normalize_enabled: Optional[bool] = None
    ai_gear_validation_enabled: Optional[bool] = None


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

    if data.ai_features_enabled is not None:
        update_fields["ai_features_enabled"] = data.ai_features_enabled
    if data.ai_crew_suggestions_enabled is not None:
        update_fields["ai_crew_suggestions_enabled"] = data.ai_crew_suggestions_enabled
    if data.ai_gig_checklist_enabled is not None:
        update_fields["ai_gig_checklist_enabled"] = data.ai_gig_checklist_enabled
    if data.ai_gear_normalize_enabled is not None:
        update_fields["ai_gear_normalize_enabled"] = data.ai_gear_normalize_enabled
    if data.ai_gear_validation_enabled is not None:
        update_fields["ai_gear_validation_enabled"] = data.ai_gear_validation_enabled

    await db.platform_settings.update_one(
        {"_id": "platform_settings"},
        {"$set": update_fields},
        upsert=True
    )
    invalidate_cache("platform_settings")
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
    invalidate_cache("event_types")
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
    invalidate_cache("event_types")
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
    invalidate_cache("role_categories")
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
    invalidate_cache("role_categories")
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


async def _get_gemini_key(db) -> str:
    """
    Get Gemini API key — priority: DB (admin settings) → env GOOGLE_GEMINI_API_KEY.
    Uses the centralized api_key_service for consistent key resolution.
    """
    from services.api_key_service import get_gemini_api_key
    return await get_gemini_api_key(db)


@router.get("/gear-catalogue/normalize")
async def normalize_gear_name_endpoint(name: str, current_user: dict = Depends(get_current_user)):
    """
    Authenticated — normalize a typed gear name using AI.
    Returns normalized name, brand, category, confidence and any matching catalogue item.
    Used for real-time suggestions while typing in the gear form.
    """
    if not name or len(name.strip()) < 2:
        return {"normalized_name": name, "brand": None, "category": None, "confidence": 0.0, "catalogue_match": None}

    from services.gear_ai_service import normalize_gear_name
    db = get_db()

    # ── Check if AI is enabled ────────────────────────────────────────────────
    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    if not cfg.get("ai_gear_normalize_enabled", cfg.get("ai_features_enabled", True)):
        return {
            "normalized_name": name,
            "brand": None,
            "category": None,
            "confidence": 0.0,
            "catalogue_match": None,
            "ai_disabled": True,
        }

    api_key = await _get_gemini_key(db)
    ai_result = await normalize_gear_name(name.strip(), api_key=api_key)

    # Try to find a matching item in the catalogue
    catalogue_match = None
    if ai_result.get("normalized_name"):
        items = await _get_gear_catalogue(db)
        norm = ai_result["normalized_name"].lower()
        for item in items:
            if item["name"].lower() == norm:
                catalogue_match = item
                break
        # Partial match fallback
        if not catalogue_match:
            for item in items:
                if norm in item["name"].lower() or item["name"].lower() in norm:
                    catalogue_match = item
                    break

    # ── Log AI usage ──────────────────────────────────────────────────────────
    try:
        import uuid as _uuid2
        await db.ai_usage_logs.insert_one({
            "_id": str(_uuid2.uuid4()),
            "user_id": current_user["id"],
            "endpoint": "gear-normalize",
            "model": "gemini-2.5-flash",
            "prompt_chars": ai_result.get("prompt_chars", 0),
            "response_chars": ai_result.get("response_chars", 0),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as log_err:
        logger.warning("[GearAI] Failed to log usage: %s", log_err)

    return {
        "normalized_name": ai_result["normalized_name"],
        "brand": ai_result["brand"],
        "category": ai_result["category"],
        "is_photography_gear": ai_result["is_photography_gear"],
        "confidence": ai_result["confidence"],
        "catalogue_match": catalogue_match,
    }




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
    """
    Authenticated user — submit a custom gear for the master catalogue.

    Auto-approval logic (two independent paths):
      1. AI confidence >= 0.85 AND is_photography_gear == True  → auto-approve immediately
      2. 3+ distinct users have submitted the same normalized gear name → auto-approve
    Otherwise → status = "pending" for manual admin review.
    """
    import uuid as _uuid
    from services.gear_ai_service import validate_gear_submission

    db = get_db()
    raw_name = data.name.strip()

    # ── Check if AI features are enabled ─────────────────────────────────────
    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    ai_enabled = cfg.get("ai_gear_validation_enabled", cfg.get("ai_features_enabled", True))

    # ── AI Validation ────────────────────────────────────────────────────────
    if ai_enabled:
        api_key = await _get_gemini_key(db)
        ai = await validate_gear_submission(raw_name, data.category, data.brand, api_key=api_key)
        # ── Log AI usage ──────────────────────────────────────────────────────
        try:
            import uuid as _uuid_log
            await db.ai_usage_logs.insert_one({
                "_id": str(_uuid_log.uuid4()),
                "user_id": current_user["id"],
                "endpoint": "gear-validate",
                "model": "gemini-2.5-flash",
                "prompt_chars": ai.get("prompt_chars", 0),
                "response_chars": ai.get("response_chars", 0),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as log_err:
            logger.warning("[GearAI] Failed to log usage: %s", log_err)
    else:
        # AI disabled — skip validation, mark as pending for manual review
        ai = {
            "is_valid": False,
            "confidence": 0.0,
            "normalized_name": raw_name,
            "normalized_brand": data.brand,
            "normalized_category": data.category,
            "reason": "AI features disabled",
            "ai_available": False,
            "prompt_chars": 0,
            "response_chars": 0,
        }
    normalized_name = ai.get("normalized_name") or raw_name
    normalized_brand = ai.get("normalized_brand") or data.brand
    normalized_category = ai.get("normalized_category") or data.category

    ai_auto_approve = ai.get("is_valid", False) and ai.get("confidence", 0.0) >= 0.85

    # ── Popularity check ─────────────────────────────────────────────────────
    # Count how many *distinct* users already submitted the same normalized gear
    existing_count = await db.custom_gear_submissions.count_documents(
        {
            "normalized_name": {"$regex": f"^{re.escape(normalized_name)}$", "$options": "i"},
            "submitted_by": {"$ne": current_user["id"]},
        }
    )
    popularity_auto_approve = existing_count >= 2  # this + 2 others = 3 total

    should_auto_approve = ai_auto_approve or popularity_auto_approve

    # ── Check for duplicate in catalogue if auto-approving ───────────────────
    added_item = None
    if should_auto_approve:
        items = await _get_gear_catalogue(db)

        # Smart duplicate detection: exact match OR significant model-word overlap
        def _is_duplicate(candidate: str, existing: str) -> bool:
            c, e = candidate.lower().strip(), existing.lower().strip()
            if c == e:
                return True
            # Build key-word sets — exclude very short tokens and common noise words
            skip = {"the", "a", "an", "and", "for", "of", "pro", "ii", "iii", "iv", "i"}
            def _words(s):
                return {w for w in re.split(r"[\s\-/]+", s) if len(w) >= 2 and w not in skip}
            c_words = _words(c)
            e_words = _words(e)
            # Need at least 2 meaningful words in BOTH sides to do word-overlap matching
            if len(c_words) < 2 or len(e_words) < 2:
                return False
            overlap = c_words & e_words
            # If 80%+ of the smaller set's meaningful words overlap → duplicate
            smaller = min(len(c_words), len(e_words))
            return smaller > 1 and len(overlap) / smaller >= 0.8

        # Check both raw user input and AI-normalized name against catalogue
        existing_match = next(
            (i for i in items if _is_duplicate(normalized_name, i["name"]) or _is_duplicate(raw_name, i["name"])),
            None
        )
        if existing_match:
            # Already in catalogue (or close enough) — log as auto_exists
            should_auto_approve = False
            status = "auto_exists"
            normalized_name = existing_match["name"]   # use the canonical name
        else:
            new_item = {
                "id": str(_uuid.uuid4()),
                "name": normalized_name,
                "category": normalized_category,
                "brand": normalized_brand,
            }
            items.append(new_item)
            await db.platform_meta.update_one(
                {"_id": "gear_catalogue"}, {"$set": {"items": items}}, upsert=True
            )
            added_item = new_item
            status = "auto_approved"
    else:
        status = "pending"

    # ── Determine auto-approval reason ───────────────────────────────────────
    auto_approve_reason = None
    if status == "auto_approved":
        if ai_auto_approve and popularity_auto_approve:
            auto_approve_reason = "ai_and_popularity"
        elif ai_auto_approve:
            auto_approve_reason = "ai_confidence"
        else:
            auto_approve_reason = "popularity_threshold"

    # ── Persist submission record ─────────────────────────────────────────────
    submission = {
        "id": str(_uuid.uuid4()),
        "name": raw_name,
        "normalized_name": normalized_name,
        "category": data.category,
        "normalized_category": normalized_category,
        "brand": data.brand,
        "normalized_brand": normalized_brand,
        "submitted_by": current_user["id"],
        "submitted_by_name": current_user.get("full_name", "Unknown User"),
        "status": status,
        "ai_confidence": ai.get("confidence", 0.0),
        "ai_valid": ai.get("is_valid", False),
        "ai_reason": ai.get("reason", ""),
        "ai_available": ai.get("ai_available", False),
        "auto_approve_reason": auto_approve_reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_gear_submissions.insert_one({**submission, "_id": submission["id"]})

    response = {k: v for k, v in submission.items()}
    response["auto_approved"] = status == "auto_approved"
    response["already_in_catalogue"] = status == "auto_exists"
    if added_item:
        response["catalogue_item"] = added_item
    return response


@router.get("/gear-submissions")
async def get_gear_submissions(admin: dict = Depends(get_admin_user)):
    """Admin — get all pending gear submissions (includes AI metadata)."""
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


# ── AI-driven resolution (manual "Validate by AI" button + scheduled cron sweep) ──

async def _ai_resolve_submission(db, submission: dict, api_key: str, resolved_by: str) -> dict:
    """
    Re-run AI validation on a single pending gear submission and resolve it definitively.
    Decision rule: is_valid == True and confidence >= 0.5  → approve (add to catalogue)
                   otherwise                                → reject
    Shared by the manual 'Validate by AI' admin action and the scheduled cron sweep.
    """
    import uuid as _uuid
    from services.gear_ai_service import validate_gear_submission

    name = submission["name"]
    category = submission.get("category")
    brand = submission.get("brand")

    ai = await validate_gear_submission(name, category, brand, api_key=api_key)
    confidence = ai.get("confidence", 0.0)
    is_valid = ai.get("is_valid", False)
    normalized_name = ai.get("normalized_name") or name
    normalized_brand = ai.get("normalized_brand") or brand
    normalized_category = ai.get("normalized_category") or category

    decision = "approved" if (is_valid and confidence >= 0.5) else "rejected"
    added_item = None

    if decision == "approved":
        items = await _get_gear_catalogue(db)
        if not any(i["name"].lower() == normalized_name.lower() for i in items):
            new_item = {
                "id": str(_uuid.uuid4()),
                "name": normalized_name,
                "category": normalized_category,
                "brand": normalized_brand,
            }
            items.append(new_item)
            await db.platform_meta.update_one(
                {"_id": "gear_catalogue"}, {"$set": {"items": items}}, upsert=True
            )
            added_item = new_item

    await db.custom_gear_submissions.update_one(
        {"id": submission["id"]},
        {"$set": {
            "status": decision,
            "ai_confidence": confidence,
            "ai_valid": is_valid,
            "ai_reason": ai.get("reason", ""),
            "ai_resolved_at": datetime.now(timezone.utc).isoformat(),
            "ai_resolved_by": resolved_by,
        }}
    )

    return {
        "submission_id": submission["id"],
        "name": submission["name"],
        "decision": decision,
        "ai_confidence": confidence,
        "ai_valid": is_valid,
        "ai_reason": ai.get("reason", ""),
        "normalized_name": normalized_name,
        "added_item": added_item,
    }


@router.post("/gear-submissions/{submission_id}/validate-ai")
async def validate_gear_submission_with_ai(submission_id: str, admin: dict = Depends(get_admin_user)):
    """Admin — manually trigger a fresh AI validation on a pending submission, resolving it to approved/rejected immediately."""
    db = get_db()
    submission = await db.custom_gear_submissions.find_one({"id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Submission is already '{submission.get('status')}' — nothing to validate")

    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    if not cfg.get("ai_gear_validation_enabled", cfg.get("ai_features_enabled", True)):
        raise HTTPException(status_code=400, detail="AI Gear Auto-Validation is disabled in Platform Settings — enable it first")

    api_key = await _get_gemini_key(db)
    if not api_key:
        raise HTTPException(status_code=400, detail="No Gemini API key configured — add one in Admin Settings → API Keys")

    return await _ai_resolve_submission(db, submission, api_key, resolved_by=f"manual_admin:{admin['id']}")


async def run_gear_validation_sweep():
    """
    Scheduled job (runs 3 AM & 5 PM daily, IST) — resolves every pending custom gear
    submission using a fresh AI validation call, auto-approving or auto-rejecting each one.
    Skips entirely if AI Gear Auto-Validation is disabled or no Gemini key is configured.
    """
    db = get_db()
    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    if not cfg.get("ai_gear_validation_enabled", cfg.get("ai_features_enabled", True)):
        logger.info("[GearCron] Skipped — AI Gear Auto-Validation is disabled in platform settings")
        return {"skipped": True, "reason": "ai_disabled"}

    api_key = await _get_gemini_key(db)
    if not api_key:
        logger.info("[GearCron] Skipped — no Gemini API key configured")
        return {"skipped": True, "reason": "no_api_key"}

    pending = await db.custom_gear_submissions.find({"status": "pending"}, {"_id": 0}).to_list(length=500)
    approved_count = 0
    rejected_count = 0
    for sub in pending:
        try:
            result = await _ai_resolve_submission(db, sub, api_key, resolved_by="cron")
            if result["decision"] == "approved":
                approved_count += 1
            else:
                rejected_count += 1
        except Exception as e:
            logger.warning("[GearCron] Failed to resolve submission %s: %s", sub.get("id"), e)

    logger.info(
        "[GearCron] Sweep complete — %d pending processed (%d approved, %d rejected)",
        len(pending), approved_count, rejected_count,
    )
    return {"skipped": False, "total": len(pending), "approved": approved_count, "rejected": rejected_count}


@router.post("/gear-submissions/run-sweep")
async def trigger_gear_validation_sweep(admin: dict = Depends(get_admin_user)):
    """Admin — manually trigger the scheduled AI validation sweep right now (same logic as the 3AM/5PM cron job)."""
    return await run_gear_validation_sweep()


# ── API Keys / Integrations ───────────────────────────────────────────────────

# Keys we manage (each has a group and a list of field keys)
API_KEY_GROUPS = {
    "razorpay": {
        "label": "Razorpay Payments",
        "description": "Accept UPI & card payments for subscriptions",
        "fields": {
            "key_id": {"label": "Key ID", "secret": False},
            "key_secret": {"label": "Key Secret", "secret": True},
            "webhook_secret": {"label": "Webhook Secret", "secret": True},
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
        "description": "Google Gemini API key for AI crew suggestions, gear normalization & checklists. Get your key from aistudio.google.com.",
        "fields": {
            "gemini_api_key": {"label": "Gemini API Key", "secret": True},
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

        # For the AI group, seed from env GOOGLE_GEMINI_API_KEY if not in DB
        if group_key == "ai" and not group_stored.get("gemini_api_key"):
            env_key = os.environ.get("GOOGLE_GEMINI_API_KEY", "")
            if env_key:
                group_stored = {"gemini_api_key": env_key}

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
