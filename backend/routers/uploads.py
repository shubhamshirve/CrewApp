"""
File Upload Router
POST /uploads/profile-picture  — secure, sanitized profile picture upload
GET  /uploads/avatar/{filename} — serve uploaded avatars (public)
"""
import os
import io
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from PIL import Image

from auth_utils import get_current_user
from db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads")

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "/app/backend/uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_DIMENSION = 3000                # px — guard against decompression bombs
OUTPUT_SIZE = (400, 400)            # square thumbnail output
OUTPUT_QUALITY = 85


def _sanitize_and_resize(data: bytes) -> bytes:
    """Validate, strip EXIF metadata, resize & square-crop. Returns JPEG bytes."""
    try:
        img = Image.open(io.BytesIO(data))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupt image file")

    # Enforce max dimensions before any processing
    w, h = img.size
    if w > MAX_DIMENSION or h > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    # Strip EXIF by rebuilding raw pixel data into a clean image
    try:
        img_clean = Image.new(img.mode, img.size)
        img_clean.putdata(list(img.getdata()))
    except Exception:
        img_clean = img

    # Normalize to RGB for JPEG output
    if img_clean.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", img_clean.size, (255, 255, 255))
        try:
            bg.paste(img_clean, mask=img_clean.split()[-1])
        except Exception:
            bg.paste(img_clean)
        img_clean = bg
    elif img_clean.mode == "P":
        img_clean = img_clean.convert("RGBA")
        bg = Image.new("RGB", img_clean.size, (255, 255, 255))
        bg.paste(img_clean, mask=img_clean.split()[-1])
        img_clean = bg
    elif img_clean.mode != "RGB":
        img_clean = img_clean.convert("RGB")

    # Center-crop to square, then resize to OUTPUT_SIZE
    w, h = img_clean.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img_clean = img_clean.crop((left, top, left + side, top + side))
    img_clean = img_clean.resize(OUTPUT_SIZE, Image.LANCZOS)

    buf = io.BytesIO()
    img_clean.save(buf, format="JPEG", quality=OUTPUT_QUALITY, optimize=True)
    return buf.getvalue()


@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Allowed: JPEG, PNG, WEBP, HEIC"
        )

    data = await file.read()
    if len(data) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 5 MB limit")
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty")

    jpeg_data = _sanitize_and_resize(data)

    # Use user ID as filename — one picture per user, auto-overwrites old one
    filename = f"{current_user['id']}.jpg"
    dest = UPLOADS_DIR / filename
    dest.write_bytes(jpeg_data)

    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    image_url = f"{backend_url}/api/uploads/avatar/{filename}"

    db = get_db()
    await db.users.update_one({"_id": current_user["id"]}, {"$set": {"profile_image": image_url}})

    return {"url": image_url}


@router.get("/avatar/{filename}")
async def serve_avatar(filename: str):
    """Public endpoint to serve profile avatars."""
    # Sanitize filename — only allow *.jpg with no path traversal
    safe = Path(filename).name
    if not safe.endswith(".jpg") or ".." in safe or "/" in safe:
        raise HTTPException(status_code=400, detail="Invalid filename")
    dest = UPLOADS_DIR / safe
    if not dest.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(str(dest), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})
