"""
Coupons Router
Admin: create / list / delete / toggle coupons
User: validate coupon before subscribing
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import get_db
from auth_utils import get_current_user, get_admin_user

router = APIRouter(prefix="/coupons")


# ── Models ────────────────────────────────────────────────────────────────────

class CreateCouponRequest(BaseModel):
    code: str = Field(..., min_length=3, max_length=30)
    discount_type: str = Field(..., pattern="^(percentage|rupees)$")
    discount_value: float = Field(..., gt=0)
    max_redemptions: int = Field(..., ge=1)
    per_user_limit: int = Field(1, ge=1)
    valid_until: Optional[str] = None           # ISO date string YYYY-MM-DD
    applicable_plan_id: Optional[str] = None    # None = any plan


def _coupon_out(c: dict) -> dict:
    c["id"] = c.pop("_id")
    return c


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("", dependencies=[Depends(get_admin_user)])
async def create_coupon(data: CreateCouponRequest):
    db = get_db()
    code = data.code.strip().upper()
    existing = await db.coupons.find_one({"_id": code})
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists")

    if data.applicable_plan_id:
        plan = await db.plans.find_one({"_id": data.applicable_plan_id})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")

    if data.valid_until:
        try:
            datetime.strptime(data.valid_until, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="valid_until must be YYYY-MM-DD")

    coupon = {
        "_id": code,
        "discount_type": data.discount_type,
        "discount_value": data.discount_value,
        "max_redemptions": data.max_redemptions,
        "per_user_limit": data.per_user_limit,
        "valid_until": data.valid_until,
        "applicable_plan_id": data.applicable_plan_id,
        "redemption_count": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.coupons.insert_one(coupon)
    return _coupon_out(coupon)


@router.get("", dependencies=[Depends(get_admin_user)])
async def list_coupons():
    db = get_db()
    coupons = await db.coupons.find().sort("created_at", -1).to_list(200)
    return [_coupon_out(c) for c in coupons]


@router.delete("/{code}", dependencies=[Depends(get_admin_user)])
async def delete_coupon(code: str):
    db = get_db()
    code = code.upper()
    res = await db.coupons.delete_one({"_id": code})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return {"message": "Coupon deleted"}


@router.patch("/{code}/toggle", dependencies=[Depends(get_admin_user)])
async def toggle_coupon(code: str):
    db = get_db()
    code = code.upper()
    coupon = await db.coupons.find_one({"_id": code})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    new_state = not coupon.get("is_active", True)
    await db.coupons.update_one({"_id": code}, {"$set": {"is_active": new_state}})
    return {"code": code, "is_active": new_state}


# ── User endpoint ─────────────────────────────────────────────────────────────

class ValidateCouponRequest(BaseModel):
    code: str
    plan_id: Optional[str] = None


@router.post("/validate")
async def validate_coupon(
    body: ValidateCouponRequest,
    current_user: dict = Depends(get_current_user),
):
    """Validate a coupon before checkout. Returns discount info."""
    db = get_db()
    code = body.code.strip().upper()

    coupon = await db.coupons.find_one({"_id": code})
    if not coupon or not coupon.get("is_active"):
        raise HTTPException(status_code=404, detail="Invalid or inactive coupon code")

    # Check validity date
    if coupon.get("valid_until"):
        expiry = datetime.strptime(coupon["valid_until"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Coupon has expired")

    # Check max redemptions
    if coupon["redemption_count"] >= coupon["max_redemptions"]:
        raise HTTPException(status_code=400, detail="Coupon has reached its maximum redemption limit")

    # Check per-user limit
    user_redemptions = await db.coupon_redemptions.count_documents({
        "coupon_code": code, "user_id": current_user["id"]
    })
    if user_redemptions >= coupon["per_user_limit"]:
        raise HTTPException(status_code=400, detail="You have already used this coupon the maximum number of times")

    # Check plan applicability
    if coupon.get("applicable_plan_id") and body.plan_id and coupon["applicable_plan_id"] != body.plan_id:
        raise HTTPException(status_code=400, detail="This coupon is not valid for the selected plan")

    # Calculate discount on plan price if plan given
    original_price = None
    plan_name = None
    if body.plan_id:
        plan = await db.plans.find_one({"_id": body.plan_id})
        if plan:
            original_price = float(plan["price"])
            plan_name = plan["name"]

    discount_amount = None
    final_price = None
    if original_price is not None:
        if coupon["discount_type"] == "percentage":
            discount_amount = round(original_price * coupon["discount_value"] / 100, 2)
        else:
            discount_amount = min(coupon["discount_value"], original_price)
        final_price = max(0, original_price - discount_amount)

    return {
        "code": code,
        "discount_type": coupon["discount_type"],
        "discount_value": coupon["discount_value"],
        "discount_amount": discount_amount,
        "original_price": original_price,
        "final_price": final_price,
        "plan_name": plan_name,
        "applicable_plan_id": coupon.get("applicable_plan_id"),
    }
