from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re

from db import get_db
from auth_utils import get_current_user, _clean_user
from cache import get_cached

router = APIRouter(prefix="/users")

# Static lists that don't need admin management
STYLE_TAGS = ["Cinematic", "Candid", "Traditional", "Documentary", "Fine Art", "Dark & Moody", "Bright & Airy"]
EDITING_TAGS = ["Lightroom", "Photoshop", "Final Cut Pro", "Premiere Pro", "DaVinci Resolve", "Capture One"]
VALID_GEAR_CATEGORIES = ["Camera", "Lens", "Lighting", "Drone", "Audio", "Other"]
VALID_ID_TYPES = ["Aadhar", "PAN", "Driving License"]

# Default roles fallback (actual values come from DB via cache)
_DEFAULT_ROLES = [
    "Lead Photographer", "Second Shooter", "Traditional Videographer",
    "Cinematic Videographer", "Drone Operator", "Photo Assistant",
    "Video Assistant", "Lighting Technician", "Photo Editor", "Video Editor",
]


async def _get_valid_roles(db) -> List[str]:
    """Return dynamic roles from cache, falling back to defaults."""
    async def _load():
        doc = await db.platform_meta.find_one({"_id": "role_categories"})
        return doc.get("items", _DEFAULT_ROLES) if doc else _DEFAULT_ROLES
    return await get_cached("role_categories", _load, ttl=300)

_URL_RE = re.compile(
    r"^https?://(?:(?:[A-Z0-9](?:[A-Z0-9\-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}|"
    r"localhost|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:/?|[/?]\S+)$",
    re.IGNORECASE,
)


def _validate_optional_url(v: Optional[str]) -> Optional[str]:
    if not v:
        return v
    v = v.strip()
    if v and not _URL_RE.match(v):
        raise ValueError("Invalid URL format — must start with http:// or https://")
    return v


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    whatsapp_number: Optional[str] = Field(None, max_length=20)
    whatsapp_same_as_mobile: Optional[bool] = None
    location: Optional[str] = Field(None, max_length=100)
    area: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=60)
    pincode: Optional[str] = Field(None, max_length=10)
    bio: Optional[str] = Field(None, max_length=1000)
    primary_role: Optional[str] = Field(None, max_length=100)
    secondary_role: Optional[str] = Field(None, max_length=100)
    primary_rate: Optional[float] = Field(None, ge=0, le=500000)
    secondary_rate: Optional[float] = Field(None, ge=0, le=500000)
    style_tags: Optional[List[str]] = None
    editing_ecosystem: Optional[List[str]] = None
    profile_image: Optional[str] = None
    instagram_url: Optional[str] = Field(None, max_length=300)
    linkedin_url: Optional[str] = Field(None, max_length=300)
    website_url: Optional[str] = Field(None, max_length=300)
    upi_id: Optional[str] = Field(None, max_length=100)
    years_of_experience: Optional[int] = Field(None, ge=0, le=60)

    @field_validator("style_tags")
    @classmethod
    def validate_style_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        invalid = [t for t in v if t not in STYLE_TAGS]
        if invalid:
            raise ValueError(f"Invalid style tags: {invalid}")
        return v

    @field_validator("instagram_url", "linkedin_url", "website_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        return _validate_optional_url(v)

    @field_validator("upi_id")
    @classmethod
    def validate_upi(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if v and not re.match(r"^[a-zA-Z0-9.\-_@]+$", v):
            raise ValueError("UPI ID contains invalid characters")
        return v


class GearItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str
    brand: Optional[str] = Field(None, max_length=100)
    model_number: Optional[str] = Field(None, max_length=100)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_GEAR_CATEGORIES:
            raise ValueError(f"Invalid category. Must be one of: {', '.join(VALID_GEAR_CATEGORIES)}")
        return v


class SettingsUpdate(BaseModel):
    is_ghost_mode: Optional[bool] = None
    is_standby: Optional[bool] = None
    connection_only_calendar: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None


class IdUpload(BaseModel):
    govt_id_base64: str = Field(..., min_length=10)
    selfie_base64: str = Field(..., min_length=10)
    id_type: str

    @field_validator("id_type")
    @classmethod
    def validate_id_type(cls, v: str) -> str:
        if v not in VALID_ID_TYPES:
            raise ValueError(f"id_type must be one of: {', '.join(VALID_ID_TYPES)}")
        return v

    @field_validator("govt_id_base64", "selfie_base64")
    @classmethod
    def validate_base64_size(cls, v: str) -> str:
        # ~10 MB limit: base64 is ~1.33× raw size → 10 MB raw ≈ 13.6 MB base64
        max_len = 14_000_000
        if len(v) > max_len:
            raise ValueError("Image file is too large (max 10 MB)")
        return v


@router.get("/search")
async def search_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    location: Optional[str] = None,
    style: Optional[str] = None,
    verified_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"is_suspended": False, "is_ghost_mode": False}
    if q:
        # Escape to prevent ReDoS — user input is literal text, not a regex pattern
        safe_q = re.escape(q.strip()[:100])
        query["full_name"] = {"$regex": safe_q, "$options": "i"}
    if role:
        valid_roles = await _get_valid_roles(db)
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role filter")
        query["$or"] = [{"primary_role": role}, {"secondary_role": role}]
    if location:
        safe_loc = re.escape(location.strip()[:100])
        query["location"] = {"$regex": safe_loc, "$options": "i"}
    if style:
        if style not in STYLE_TAGS:
            raise HTTPException(status_code=400, detail="Invalid style filter")
        query["style_tags"] = {"$in": [style]}
    if verified_only:
        query["is_verified"] = True

    cursor = db.users.find(query, {"password_hash": 0}).limit(50)
    users = await cursor.to_list(50)
    return [_clean_user(u) for u in users]


@router.get("/meta/options")
async def get_meta_options():
    db = get_db()
    roles = await _get_valid_roles(db)
    return {"roles": roles, "style_tags": STYLE_TAGS, "editing_ecosystem": EDITING_TAGS}


@router.get("/available")
async def get_available_users(
    date: str,
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    if role:
        valid_roles = await _get_valid_roles(db)
        if role not in valid_roles:
            raise HTTPException(status_code=400, detail="Invalid role filter")
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format")
    booked_ids = await db.gig_invites.distinct(
        "freelancer_id",
        {"status": "accepted", "session_date": date}
    )
    query: dict = {"is_suspended": False, "is_ghost_mode": False, "_id": {"$nin": booked_ids}, "is_verified": True}
    if role:
        query["$or"] = [{"primary_role": role}, {"secondary_role": role}]
    cursor = db.users.find(query, {"password_hash": 0}).limit(50)
    users = await cursor.to_list(50)
    return [_clean_user(u) for u in users]


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: Optional[dict] = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _clean_user({**user})


@router.put("/profile")
async def update_profile(data: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Validate roles against DB-managed list
    if data.primary_role or data.secondary_role:
        valid_roles = await _get_valid_roles(db)
        if data.primary_role and data.primary_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
        if data.secondary_role and data.secondary_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if data.whatsapp_same_as_mobile and data.phone:
        update_data["whatsapp_number"] = data.phone
    elif data.whatsapp_same_as_mobile:
        existing = await db.users.find_one({"_id": current_user["id"]}, {"phone": 1})
        if existing:
            update_data["whatsapp_number"] = existing.get("phone", "")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if update_data:
        await db.users.update_one({"_id": current_user["id"]}, {"$set": update_data})
    user = await db.users.find_one({"_id": current_user["id"]})
    return _clean_user(user)


@router.post("/gear")
async def add_gear(gear: GearItem, current_user: dict = Depends(get_current_user)):
    db = get_db()
    gear_item = {**gear.model_dump(), "id": str(uuid.uuid4())}
    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$push": {"gear_vault": gear_item}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return gear_item


@router.put("/gear/{gear_id}")
async def edit_gear(gear_id: str, gear: GearItem, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": current_user["id"], "gear_vault.id": gear_id},
        {"$set": {
            "gear_vault.$.name": gear.name,
            "gear_vault.$.category": gear.category,
            "gear_vault.$.brand": gear.brand,
            "gear_vault.$.model_number": gear.model_number,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"message": "Gear updated", "id": gear_id, **gear.model_dump()}


@router.delete("/gear/{gear_id}")
async def delete_gear(gear_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$pull": {"gear_vault": {"id": gear_id}}}
    )
    return {"message": "Gear removed"}


@router.post("/id-upload")
async def upload_id(data: IdUpload, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user.get("verification_status") == "approved":
        raise HTTPException(status_code=400, detail="Already verified — no resubmission needed")
    await db.users.update_one(
        {"_id": current_user["id"]},
        {
            "$set": {
                "govt_id_url": data.govt_id_base64,
                "selfie_url": data.selfie_base64,
                "id_type": data.id_type,
                "verification_status": "pending",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )
    return {"message": "ID submitted for verification. Admin will review within 24 hours."}


@router.put("/settings")
async def update_settings(data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": current_user["id"]}, {"$set": update_data})
    user = await db.users.find_one({"_id": current_user["id"]})
    return _clean_user(user)


@router.put("/onboarding/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$set": {"onboarding_complete": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Onboarding complete"}
