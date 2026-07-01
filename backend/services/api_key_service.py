"""
Centralized API key fetching service.
Priority for all keys: DB (Admin Settings → platform_secrets) → env var fallback.
"""
import os
import logging

logger = logging.getLogger(__name__)


async def get_gemini_api_key(db) -> str:
    """
    Fetch Google Gemini API key with priority:
      1. DB — Admin Settings → platform_secrets.gemini.gemini_api_key
      2. Env var — GOOGLE_GEMINI_API_KEY
    Returns empty string if not configured anywhere.
    """
    try:
        doc = await db.platform_secrets.find_one({"_id": "api_keys"})
        if doc:
            # The "ai" group stores gemini_api_key under doc["ai"]["gemini_api_key"]
            db_key = doc.get("ai", {}).get("gemini_api_key", "").strip()
            if db_key:
                return db_key
    except Exception as exc:
        logger.error("[APIKeyService] DB read error while fetching Gemini key: %s", exc)
    return os.environ.get("GOOGLE_GEMINI_API_KEY", "").strip()
