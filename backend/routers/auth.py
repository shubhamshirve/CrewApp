from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime, timezone
import uuid
import random
import re
import string

from db import get_db
from auth_utils import hash_password, verify_password, create_access_token, get_current_user, _clean_user
from rate_limit import limiter

router = APIRouter(prefix="/auth")

_PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")
_URL_RE = re.compile(
    r"^https?://"
    r"(?:(?:[A-Z0-9](?:[A-Z0-9\-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
    r"localhost|\d{1,3}(?:\.\d{1,3}){3})"
    r"(?::\d+)?(?:/?|[/?]\S+)$",
    re.IGNORECASE,
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)
    location: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=4, max_length=10)
    referral_code: Optional[str] = Field(None, max_length=20)
    whatsapp_number: Optional[str] = Field(None, max_length=20)
    area: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field("India", max_length=60)

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v

    @field_validator("phone", "whatsapp_number")
    @classmethod
    def clean_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        digits_only = re.sub(r"[\s\-\(\)\+]", "", v)
        if not re.match(r"^\d{7,15}$", digits_only):
            raise ValueError("Invalid phone number format (7–15 digits)")
        return v

    @field_validator("pincode")
    @classmethod
    def clean_pincode(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{4,10}$", v):
            raise ValueError("Pincode must be 4–10 digits")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


def generate_referral_code(name: str) -> str:
    prefix = "".join(c for c in name[:3].upper() if c.isalpha()) or "CRW"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}{suffix}"


@router.post("/register")
@limiter.limit("3/minute")
async def register(request: Request, data: RegisterRequest):
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
        "full_name": data.full_name.strip(),
        "phone": data.phone.strip(),
        "whatsapp_number": (data.whatsapp_number or data.phone).strip(),
        "location": data.location.strip(),
        "area": (data.area or "").strip(),
        "state": (data.state or "").strip(),
        "country": (data.country or "India").strip(),
        "pincode": data.pincode.strip(),
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
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest):
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
        "user_agent": request.headers.get("user-agent", "unknown")[:512],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token, "user": _clean_user({**user})}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
