from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
import os
from db import get_db

SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    import warnings
    SECRET_KEY = "insecure-default-dev-key-change-me-in-backend-env"
    warnings.warn(
        "JWT_SECRET is not set — using an insecure default key. "
        "Set a proper JWT_SECRET in backend/.env for production!",
        RuntimeWarning,
        stacklevel=2,
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def create_impersonation_token(user_id: str, admin_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "impersonated_by": admin_id},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_email_verified_token(email: str) -> str:
    """Short-lived token (15 min) proving the email was OTP-verified."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    return jwt.encode(
        {"email": email.lower(), "exp": expire, "type": "email_verified"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_email_verified_token(token: str) -> str | None:
    """Returns the email string if token is valid, None otherwise."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "email_verified":
            return None
        return payload.get("email")
    except JWTError:
        return None


def _clean_user(user: dict) -> dict:
    user = {k: v for k, v in user.items() if k != "password_hash"}
    if "_id" in user:
        user["id"] = str(user.pop("_id"))
    return user


async def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _clean_user(user)


async def get_optional_user(token: str = Depends(oauth2_scheme)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    return _clean_user(user) if user else None


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
