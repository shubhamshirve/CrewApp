"""
Gear AI Service
Uses Google Gemini (via emergentintegrations) to:
  1. normalize_gear_name()     — normalize a typed gear name in real-time
  2. validate_gear_submission() — validate + normalize a custom gear submission
                                   and decide auto-approval confidence
"""
import json
import logging
import os
import re
import uuid

logger = logging.getLogger(__name__)

_GEMINI_KEY_ENV = "GOOGLE_GEMINI_API_KEY"

VALID_CATEGORIES = ["Camera", "Lens", "Lighting", "Drone", "Audio", "Accessories", "Other"]


def _get_api_key() -> str:
    """Return Google Gemini API key from env var (fallback only when api_key not provided via param)."""
    return os.environ.get(_GEMINI_KEY_ENV, "").strip()


async def _call_gemini(api_key: str, session_id: str, system_msg: str, prompt: str) -> str:
    """
    Call Gemini with the provided API key.
    Returns the raw text response or raises on failure.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("gemini", "gemini-2.5-flash")
    return await chat.send_message(UserMessage(text=prompt))


def _extract_json(text: str) -> dict:
    """Extract the first JSON object from a Gemini response string."""
    # Try direct parse first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", text).strip().strip("`")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Find first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


async def normalize_gear_name(name: str, api_key: str = None) -> dict:
    """
    Normalize a photography gear name using Gemini.
    api_key: pass the key from DB (Admin Settings). Falls back to env if None.
    """
    key = api_key or _get_api_key()
    if not key:
        logger.warning("[GearAI] No API key configured — skipping normalization")
        return {"normalized_name": name, "brand": None, "category": "Other",
                "is_photography_gear": False, "confidence": 0.0,
                "prompt_chars": 0, "response_chars": 0}

    prompt = (
        "You are a photography gear database expert. Normalize the given gear name to its "
        "correct, official product name.\n\n"
        f'Input gear name: "{name}"\n\n'
        "Return ONLY a valid JSON object, no explanation, no markdown:\n"
        "{\n"
        '  "normalized_name": "properly formatted official product name",\n'
        '  "brand": "brand name or null if unknown",\n'
        '  "category": "one of: Camera, Lens, Lighting, Drone, Audio, Accessories, Other",\n'
        '  "is_photography_gear": true or false,\n'
        '  "confidence": 0.0 to 1.0\n'
        "}\n\n"
        "Examples:\n"
        '- "sony a7iv"    → {"normalized_name": "Sony A7 IV", "brand": "Sony", "category": "Camera", "is_photography_gear": true, "confidence": 0.97}\n'
        '- "godox ad200"  → {"normalized_name": "Godox AD200 Pro", "brand": "Godox", "category": "Lighting", "is_photography_gear": true, "confidence": 0.95}\n'
        '- "sigma 35 art" → {"normalized_name": "Sigma 35mm f/1.4 DG HSM Art", "brand": "Sigma", "category": "Lens", "is_photography_gear": true, "confidence": 0.93}\n'
        '- "random stuff" → {"normalized_name": "random stuff", "brand": null, "category": "Other", "is_photography_gear": false, "confidence": 0.05}\n'
    )

    try:
        session_id = f"gear_normalize_{uuid.uuid4().hex[:10]}"
        response = await _call_gemini(
            api_key=key,
            session_id=session_id,
            system_msg=(
                "You are a precise photography gear database assistant. "
                "Always respond with valid JSON only, no extra text."
            ),
            prompt=prompt,
        )
        data = _extract_json(response)
        category = data.get("category", "Other")
        if category not in VALID_CATEGORIES:
            category = "Other"
        return {
            "normalized_name": data.get("normalized_name", name) or name,
            "brand": data.get("brand") or None,
            "category": category,
            "is_photography_gear": bool(data.get("is_photography_gear", False)),
            "confidence": float(data.get("confidence", 0.0)),
            "prompt_chars": len(prompt),
            "response_chars": len(response),
        }
    except Exception as exc:
        logger.error("[GearAI] normalize_gear_name error: %s", exc)
        return {"normalized_name": name, "brand": None, "category": "Other",
                "is_photography_gear": False, "confidence": 0.0,
                "prompt_chars": 0, "response_chars": 0}


async def validate_gear_submission(name: str, category: str, brand: str | None = None, api_key: str = None) -> dict:
    """
    Validate a custom gear submission using Gemini.
    api_key: pass the key from DB (Admin Settings). Falls back to env if None.
    """
    key = api_key or _get_api_key()
    if not key:
        logger.warning("[GearAI] No API key configured — skipping validation")
        return {"is_valid": False, "confidence": 0.0, "normalized_name": name,
                "normalized_brand": brand, "normalized_category": category,
                "reason": "AI validation not configured", "ai_available": False,
                "prompt_chars": 0, "response_chars": 0}

    brand_str = brand if brand else "unknown"
    prompt = (
        "You are a photography gear validator. Determine if the submitted item is a real, "
        "identifiable photography or videography product.\n\n"
        f'Name: "{name}"\n'
        f'Category: "{category}"\n'
        f'Brand: "{brand_str}"\n\n'
        "Return ONLY valid JSON, no explanation:\n"
        "{\n"
        '  "is_valid": true or false,\n'
        '  "confidence": 0.0 to 1.0,\n'
        '  "normalized_name": "correct official product name",\n'
        '  "normalized_brand": "correct brand name or null",\n'
        '  "normalized_category": "Camera|Lens|Lighting|Drone|Audio|Accessories|Other",\n'
        '  "reason": "brief one-line explanation"\n'
        "}\n\n"
        "Mark is_valid=true when: real photography/videography product, specific enough to identify.\n"
        "Mark is_valid=false when: generic non-photography item, spam, or too vague to identify.\n"
        "Set confidence >= 0.85 only for well-known, clearly identifiable products.\n"
    )

    try:
        session_id = f"gear_validate_{uuid.uuid4().hex[:10]}"
        response = await _call_gemini(
            api_key=key,
            session_id=session_id,
            system_msg=(
                "You are a precise photography gear validation assistant. "
                "Always respond with valid JSON only, no extra text."
            ),
            prompt=prompt,
        )
        data = _extract_json(response)
        norm_cat = data.get("normalized_category", category)
        if norm_cat not in VALID_CATEGORIES:
            norm_cat = category if category in VALID_CATEGORIES else "Other"
        return {
            "is_valid": bool(data.get("is_valid", False)),
            "confidence": float(data.get("confidence", 0.0)),
            "normalized_name": data.get("normalized_name", name) or name,
            "normalized_brand": data.get("normalized_brand") or brand or None,
            "normalized_category": norm_cat,
            "reason": data.get("reason", ""),
            "ai_available": True,
            "prompt_chars": len(prompt),
            "response_chars": len(response),
        }

    except Exception as exc:
        logger.error("[GearAI] validate_gear_submission error: %s", exc)
        return {"is_valid": False, "confidence": 0.0, "normalized_name": name,
                "normalized_brand": brand, "normalized_category": category,
                "reason": f"AI error: {exc}", "ai_available": False,
                "prompt_chars": 0, "response_chars": 0}
