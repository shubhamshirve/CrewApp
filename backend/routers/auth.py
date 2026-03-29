from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import random
import string

from db import get_db
from auth_utils import hash_password, verify_password, create_access_token, get_current_user, _clean_user

router = APIRouter(prefix="/auth")


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str
    location: str
    pincode: str
    referral_code: Optional[str] = None
    whatsapp_number: Optional[str] = None
    area: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "India"


class LoginRequest(BaseModel):
    email: str
    password: str


def generate_referral_code(name: str) -> str:
    prefix = "".join(c for c in name[:3].upper() if c.isalpha()) or "CRW"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}{suffix}"


@router.post("/register")
async def register(data: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    referrer = None
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code.upper()})

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    user_doc = {
        "_id": user_id,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "full_name": data.full_name,
        "phone": data.phone,
        "whatsapp_number": data.whatsapp_number or data.phone,
        "location": data.location,
        "area": data.area or "",
        "state": data.state or "",
        "country": data.country or "India",
        "pincode": data.pincode,
        "primary_role": None,
        "secondary_role": None,
        "primary_rate": 0.0,
        "secondary_rate": 0.0,
        "gear_vault": [],
        "style_tags": [],
        "editing_ecosystem": [],
        "bio": "",
        "profile_image": None,
        "instagram_url": "",
        "linkedin_url": "",
        "website_url": "",
        "upi_id": "",
        "years_of_experience": None,
        "is_verified": False,
        "verification_status": "not_submitted",
        "govt_id_url": None,
        "selfie_url": None,
        "referral_code": generate_referral_code(data.full_name),
        "referred_by": str(referrer["_id"]) if referrer else None,
        "is_ghost_mode": False,
        "is_standby": False,
        "connection_only_calendar": False,
        "subscription_plan": "free",
        "subscription_expires_at": None,
        "whatsapp_enabled": False,
        "wallet_balance": 0.0,
        "negative_stars": 0,
        "is_suspended": False,
        "is_admin": False,
        "avg_rating": None,
        "total_ratings": 0,
        "onboarding_complete": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id)
    return {"token": token, "user": _clean_user({**user_doc})}


@router.post("/login")
async def login(data: LoginRequest, request: Request):
    db = get_db()
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("is_suspended"):
        raise HTTPException(status_code=403, detail="Account suspended. Please contact support.")
    token = create_access_token(str(user["_id"]))
    await db.login_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": str(user["_id"]),
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token, "user": _clean_user({**user})}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
