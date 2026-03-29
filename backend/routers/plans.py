"""
Plans Router — Subscription plans with feature flags.
Admin manages plans; users subscribe via wallet.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging

from db import get_db
from auth_utils import get_admin_user, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plans")


# ── Models ────────────────────────────────────────────────────────────────────

class PlanFeatures(BaseModel):
    public_gig_enabled: bool = False
    whatsapp_enabled: bool = False


class CreatePlanRequest(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    features: PlanFeatures = PlanFeatures()
    legacy_tier: Optional[str] = None   # "base" | "premium" | None
    is_active: bool = True
    sort_order: int = 0


class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    features: Optional[PlanFeatures] = None
    legacy_tier: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _clean(p: dict) -> dict:
    p = dict(p)
    if "_id" in p:
        p["id"] = str(p.pop("_id"))
    return p


async def _migrate_users(db, legacy_tier: str, plan_id: str, features: dict) -> int:
    """Set active_plan_id + features on all users whose subscription_plan == legacy_tier."""
    result = await db.users.update_many(
        {"subscription_plan": legacy_tier},
        {"$set": {
            "active_plan_id": plan_id,
            "active_plan_features": features,
            "whatsapp_enabled": features.get("whatsapp_enabled", False),
        }}
    )
    logger.info(f"Plan migration: {result.modified_count} users migrated from '{legacy_tier}' to plan {plan_id}")
    return result.modified_count


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("")
async def list_active_plans():
    """List all active plans — used by Wallet subscription UI."""
    db = get_db()
    plans = await db.plans.find({"is_active": True}).sort("sort_order", 1).to_list(100)
    return {"plans": [_clean(p) for p in plans]}


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/all")
async def list_all_plans(_: dict = Depends(get_admin_user)):
    """List ALL plans including inactive (admin only)."""
    db = get_db()
    plans = await db.plans.find({}).sort("sort_order", 1).to_list(100)
    # Attach user counts
    result = []
    for p in plans:
        count = await db.users.count_documents({"active_plan_id": str(p["_id"])})
        cp = _clean(p)
        cp["user_count"] = count
        result.append(cp)
    return {"plans": result}


@router.post("/admin")
async def create_plan(data: CreatePlanRequest, _: dict = Depends(get_admin_user)):
    """Create a new plan (admin only)."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    plan_id = str(uuid.uuid4())
    plan_doc = {
        "_id": plan_id,
        "name": data.name,
        "price": data.price,
        "description": data.description or "",
        "features": data.features.dict(),
        "legacy_tier": data.legacy_tier,
        "is_active": data.is_active,
        "sort_order": data.sort_order,
        "created_at": now,
        "updated_at": now,
    }
    await db.plans.insert_one(plan_doc)

    migrated = 0
    if data.legacy_tier in ("base", "premium"):
        migrated = await _migrate_users(db, data.legacy_tier, plan_id, data.features.dict())

    result = _clean(plan_doc)
    result["user_count"] = migrated
    return {"plan": result, "migrated_users": migrated}


@router.put("/admin/{plan_id}")
async def update_plan(plan_id: str, data: UpdatePlanRequest, _: dict = Depends(get_admin_user)):
    """Update an existing plan (admin only). Triggers re-migration if legacy_tier is set."""
    db = get_db()
    existing = await db.plans.find_one({"_id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:       updates["name"] = data.name
    if data.price is not None:      updates["price"] = data.price
    if data.description is not None: updates["description"] = data.description
    if data.features is not None:   updates["features"] = data.features.dict()
    if data.legacy_tier is not None: updates["legacy_tier"] = data.legacy_tier
    if data.is_active is not None:  updates["is_active"] = data.is_active
    if data.sort_order is not None: updates["sort_order"] = data.sort_order

    await db.plans.update_one({"_id": plan_id}, {"$set": updates})

    # Re-migrate if legacy_tier is/was set
    effective_legacy = data.legacy_tier if data.legacy_tier is not None else existing.get("legacy_tier")
    migrated = 0
    if effective_legacy in ("base", "premium") and data.legacy_tier is not None:
        effective_features = data.features.dict() if data.features else existing.get("features", {})
        migrated = await _migrate_users(db, effective_legacy, plan_id, effective_features)

    updated = await db.plans.find_one({"_id": plan_id})
    result = _clean(updated)
    result["user_count"] = await db.users.count_documents({"active_plan_id": plan_id})
    return {"plan": result, "migrated_users": migrated}


@router.delete("/admin/{plan_id}")
async def delete_plan(plan_id: str, _: dict = Depends(get_admin_user)):
    """Delete a plan. Fails if any users are subscribed to it."""
    db = get_db()
    existing = await db.plans.find_one({"_id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")

    count = await db.users.count_documents({"active_plan_id": plan_id})
    if count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {count} user(s) are on this plan. Deactivate it instead."
        )

    await db.plans.delete_one({"_id": plan_id})
    return {"message": "Plan deleted successfully"}


@router.post("/admin/{plan_id}/migrate")
async def migrate_plan_users(plan_id: str, _: dict = Depends(get_admin_user)):
    """Manually trigger migration of users from legacy_tier to this plan."""
    db = get_db()
    plan = await db.plans.find_one({"_id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.get("legacy_tier"):
        raise HTTPException(status_code=400, detail="Plan has no legacy_tier set")

    count = await _migrate_users(db, plan["legacy_tier"], plan_id, plan.get("features", {}))
    return {"message": f"Migrated {count} user(s) from '{plan['legacy_tier']}' to '{plan['name']}'", "migrated_count": count}
