from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import logging
from datetime import datetime, timezone

from db import get_db
from auth_utils import get_current_user

logger = logging.getLogger(__name__)

_AI_COST_PER_1K_CHARS_INR = 0.001  # adjust as Gemini pricing updates

router = APIRouter(prefix="/ai")


class CrewSuggestionRequest(BaseModel):
    gig_title: str
    event_types: List[str]
    dates: List[str]
    location: str
    roles_needed: List[str]
    budget_per_person: Optional[float] = None
    style_preference: Optional[str] = None


@router.post("/crew-suggestions")
async def get_crew_suggestions(data: CrewSuggestionRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Check if AI features are enabled in platform settings
    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    if not cfg.get("ai_features_enabled", True):
        return {"suggestion": "AI features are currently disabled by the platform admin.", "ai_disabled": True}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        session_id = f"crew_suggestion_{current_user['id']}_{uuid.uuid4().hex[:8]}"
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=session_id,
            system_message=(
                "You are an expert in the Indian wedding photography industry. "
                "Help lead photographers find the best freelance crew members. "
                "Provide concise, actionable suggestions about: what qualities to look for, "
                "fair pricing for Indian market, how to coordinate the team, and any specific "
                "tips for the event types mentioned. Keep responses under 300 words."
            )
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"I'm booking a crew for '{data.gig_title}'.\n"
            f"Event types: {', '.join(data.event_types)}\n"
            f"Dates: {', '.join(data.dates)}\n"
            f"Location: {data.location}\n"
            f"Roles needed: {', '.join(data.roles_needed)}\n"
        )
        if data.budget_per_person:
            prompt += f"Budget per person: ₹{data.budget_per_person:.0f}\n"
        if data.style_preference:
            prompt += f"Style preference: {data.style_preference}\n"
        prompt += "\nWhat should I look for when selecting crew for this event? Any specific tips?"

        response = await chat.send_message(UserMessage(text=prompt))
        try:
            total_chars = len(prompt) + len(response)
            await db.ai_usage_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "endpoint": "crew-suggestions",
                "session_id": session_id,
                "model": "gemini-2.5-flash",
                "prompt_chars": len(prompt),
                "response_chars": len(response),
                "cost_estimate_inr": round(total_chars / 1000 * _AI_COST_PER_1K_CHARS_INR, 6),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error("ai_usage_log write failed: %s", e)
        return {"suggestion": response, "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@router.post("/gig-checklist")
async def get_gig_checklist(data: CrewSuggestionRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    cfg = await db.platform_settings.find_one({"_id": "platform_settings"}) or {}
    if not cfg.get("ai_features_enabled", True):
        return {"checklist": "AI features are currently disabled by the platform admin.", "ai_disabled": True}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        checklist_session = f"checklist_{uuid.uuid4().hex[:12]}"
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=checklist_session,
            system_message="You are an expert wedding photography coordinator in India. Generate concise, practical checklists."
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = (
            f"Generate a pre-event checklist for a {', '.join(data.event_types)} event "
            f"at {data.location} on {', '.join(data.dates)}. "
            f"Team includes: {', '.join(data.roles_needed)}. "
            "Format as a bullet list with max 10 items. Be specific to Indian weddings."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        try:
            total_chars = len(prompt) + len(response)
            await db.ai_usage_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "endpoint": "gig-checklist",
                "session_id": checklist_session,
                "model": "gemini-2.5-flash",
                "prompt_chars": len(prompt),
                "response_chars": len(response),
                "cost_estimate_inr": round(total_chars / 1000 * _AI_COST_PER_1K_CHARS_INR, 6),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.error("ai_usage_log write failed: %s", e)
        return {"checklist": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
