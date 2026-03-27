from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import base64

from db import get_db
from auth_utils import get_current_user, _clean_user

router = APIRouter(prefix="/users")

VALID_ROLES = [
    "Lead Photographer", "Second Shooter", "Traditional Videographer",
    "Cinematic Videographer", "Drone Operator", "Photo Assistant",
    "Video Assistant", "Lighting Technician", "Photo Editor", "Video Editor"
]

STYLE_TAGS = ["Cinematic", "Candid", "Traditional", "Documentary", "Fine Art", "Dark & Moody", "Bright & Airy"]
EDITING_TAGS = ["Lightroom", "Photoshop", "Final Cut Pro", "Premiere Pro", "DaVinci Resolve", "Capture One"]


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    pincode: Optional[str] = None
    bio: Optional[str] = None
    primary_role: Optional[str] = None
    secondary_role: Optional[str] = None
    primary_rate: Optional[float] = None
    secondary_rate: Optional[float] = None
    style_tags: Optional[List[str]] = None
    editing_ecosystem: Optional[List[str]] = None
    profile_image: Optional[str] = None


class GearItem(BaseModel):
    name: str
    category: str  # Camera, Lens, Lighting, Drone, Audio, Other
    brand: Optional[str] = None
    model_number: Optional[str] = None


class SettingsUpdate(BaseModel):
    is_ghost_mode: Optional[bool] = None
    is_standby: Optional[bool] = None
    connection_only_calendar: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None


class IdUpload(BaseModel):
    govt_id_base64: str
    selfie_base64: str
    id_type: str  # Aadhar, PAN, Driving License


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
        query["full_name"] = {"$regex": q, "$options": "i"}
    if role:
        query["$or"] = [{"primary_role": role}, {"secondary_role": role}]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if style:
        query["style_tags"] = {"$in": [style]}
    if verified_only:
        query["is_verified"] = True

    cursor = db.users.find(query, {"password_hash": 0}).limit(50)
    users = await cursor.to_list(50)
    return [_clean_user(u) for u in users]


@router.get("/meta/options")
async def get_meta_options():
    return {"roles": VALID_ROLES, "style_tags": STYLE_TAGS, "editing_ecosystem": EDITING_TAGS}


@router.get("/available")
async def get_available_users(
    date: str,
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Get users available on a specific date (not booked)."""
    db = get_db()
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
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
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
    if current_user.get("verification_status") in ("approved",):
        raise HTTPException(status_code=400, detail="Already verified")
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
