from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
import random
import re
import string
import hashlib

from db import get_db
from auth_utils import (
    hash_password, verify_password, create_access_token, get_current_user, _clean_user,
    create_email_verified_token, decode_email_verified_token,
)
from rate_limit import limiter
from services.email_service import send_otp_email

router = APIRouter(prefix="/auth")

_OTP_MAX_ATTEMPTS = 5
_OTP_TTL_MINUTES = 10


# ── Pydantic models ───────────────────────────────────────────────────────────

class SendOtpRequest(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(None, max_length=100)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)
    location: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., min_length=4, max_length=10)
    email_verified_token: str = Field(..., description="Token from /auth/verify-otp")
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
        return v.strip()

    @field_validator("phone", "whatsapp_number")
    @classmethod
    def clean_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits_only = re.sub(r"[\s\-\(\)\+]", "", v.strip())
        if not re.match(r"^\d{7,15}$", digits_only):
            raise ValueError("Invalid phone number format (7–15 digits)")
        return v.strip()

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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _generate_referral_code(name: str) -> str:
    prefix = "".join(c for c in name[:3].upper() if c.isalpha()) or "CRW"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}{suffix}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/send-otp")
@limiter.limit("3/minute")
async def send_otp(request: Request, data: SendOtpRequest):
    """Generate and email a 6-digit OTP for email verification."""
    db = get_db()
    email = data.email.lower()

    # Block already-registered emails early
    existing = await db.users.find_one({"email": email}, {"_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Rate-limit: one OTP per email per minute (regardless of IP)
    recent = await db.otp_verifications.find_one({"_id": email})
    if recent:
        created = datetime.fromisoformat(recent["created_at"])
        if (datetime.now(timezone.utc) - created).total_seconds() < 60:
            raise HTTPException(
                status_code=429,
                detail="Please wait 60 seconds before requesting a new code"
            )

    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES)

    await db.otp_verifications.replace_one(
        {"_id": email},
        {
            "_id": email,
            "otp_hash": _hash_otp(otp),
            "expires_at": expires_at.isoformat(),
            "attempts": 0,
            "verified": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        upsert=True,
    )

    result = await send_otp_email(db, email, otp, data.full_name or "")
    is_mock = result.get("status") in ("simulated", "failed") or not result.get("status") == "sent"

    response: dict = {"message": f"Verification code sent to {email}"}
    # In dev/mock mode expose the OTP so testing works without a real inbox
    if is_mock:
        response["otp_dev"] = otp
    return response


@router.post("/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(request: Request, data: VerifyOtpRequest):
    """Verify the OTP and return a short-lived email_verified_token."""
    db = get_db()
    email = data.email.lower()
    record = await db.otp_verifications.find_one({"_id": email})

    if not record:
        raise HTTPException(status_code=400, detail="No verification code found. Please request a new one.")

    # Check expiry
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.otp_verifications.delete_one({"_id": email})
        raise HTTPException(status_code=400, detail="Verification code expired. Please request a new one.")

    # Check too many attempts
    if record.get("attempts", 0) >= _OTP_MAX_ATTEMPTS:
        await db.otp_verifications.delete_one({"_id": email})
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new code.")

    if _hash_otp(data.otp) != record["otp_hash"]:
        await db.otp_verifications.update_one(
            {"_id": email},
            {"$inc": {"attempts": 1}}
        )
        remaining = _OTP_MAX_ATTEMPTS - record.get("attempts", 0) - 1
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {remaining} attempt(s) remaining."
        )

    # Mark as verified
    await db.otp_verifications.update_one(
        {"_id": email},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )

    token = create_email_verified_token(email)
    return {"message": "Email verified", "email_verified_token": token}


@router.post("/register")
@limiter.limit("5/minute")
async def register(request: Request, data: RegisterRequest):
    """Create account — requires a valid email_verified_token from /verify-otp."""
    db = get_db()

    # Validate the email verified token
    verified_email = decode_email_verified_token(data.email_verified_token)
    if not verified_email:
        raise HTTPException(status_code=400, detail="Email verification token is invalid or expired. Please verify your email again.")
    if verified_email != data.email.lower():
        raise HTTPException(status_code=400, detail="Verified email does not match registration email.")

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
        "referral_code": _generate_referral_code(data.full_name),
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

    # Clean up OTP record
    await db.otp_verifications.delete_one({"_id": data.email.lower()})

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
