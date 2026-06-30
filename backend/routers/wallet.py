import os
import logging
import razorpay
import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from db import get_db
from auth_utils import get_current_user, _clean_user
from services.notifications_service import send_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wallet")

# Static fallback defaults (overridden by DB at runtime)
_DEFAULT_BASE_PRICE_RS = 69
_DEFAULT_PREMIUM_PRICE_RS = 99
_DEFAULT_REFERRAL_REWARD = 50


async def _get_platform_settings(db):
    """Return pricing settings from DB, with fallback to defaults."""
    doc = await db.platform_settings.find_one({"_id": "platform_settings"})
    if not doc:
        return {
            "base_plan_price": _DEFAULT_BASE_PRICE_RS,
            "premium_plan_price": _DEFAULT_PREMIUM_PRICE_RS,
            "base_plan_name": "Base Plan",
            "premium_plan_name": "Premium Plan",
            "referral_reward": _DEFAULT_REFERRAL_REWARD,
        }
    return doc


async def _apply_coupon(db, code: str, user_id: str, original_price: float, plan_id: Optional[str]) -> tuple[float, Optional[str]]:
    """
    Validate and apply coupon. Returns (discounted_price, coupon_code_used).
    Raises HTTPException on invalid coupon.
    """
    code = code.strip().upper()
    coupon = await db.coupons.find_one({"_id": code})
    if not coupon or not coupon.get("is_active"):
        raise HTTPException(status_code=400, detail="Invalid or inactive coupon code")

    if coupon.get("valid_until"):
        from datetime import datetime, timezone
        expiry = datetime.strptime(coupon["valid_until"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Coupon has expired")

    if coupon["redemption_count"] >= coupon["max_redemptions"]:
        raise HTTPException(status_code=400, detail="Coupon has reached its maximum redemption limit")

    user_uses = await db.coupon_redemptions.count_documents({"coupon_code": code, "user_id": user_id})
    if user_uses >= coupon["per_user_limit"]:
        raise HTTPException(status_code=400, detail="You have already used this coupon the maximum number of times")

    if coupon.get("applicable_plan_id") and plan_id and coupon["applicable_plan_id"] != plan_id:
        raise HTTPException(status_code=400, detail="This coupon is not valid for the selected plan")

    if coupon["discount_type"] == "percentage":
        discount = round(original_price * coupon["discount_value"] / 100, 2)
    else:
        discount = min(coupon["discount_value"], original_price)

    return max(0.0, original_price - discount), code


async def _record_coupon_redemption(db, code: str, user_id: str, plan_id: Optional[str], discount_amount: float):
    """Record a coupon use and bump the redemption counter."""
    await db.coupon_redemptions.insert_one({
        "_id": str(uuid.uuid4()),
        "coupon_code": code,
        "user_id": user_id,
        "plan_id": plan_id,
        "discount_amount": discount_amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.coupons.update_one({"_id": code}, {"$inc": {"redemption_count": 1}})


def get_razorpay_client():
    return razorpay.Client(auth=(
        os.environ.get("RAZORPAY_KEY_ID"),
        os.environ.get("RAZORPAY_KEY_SECRET")
    ))


def _require_razorpay():
    """Raise a clear 503 if Razorpay credentials are not configured."""
    if not os.environ.get("RAZORPAY_KEY_ID") or not os.environ.get("RAZORPAY_KEY_SECRET"):
        raise HTTPException(
            status_code=503,
            detail="Payment gateway is not configured. Please add wallet balance to pay or contact support."
        )


class SubscribeRequest(BaseModel):
    plan_id: Optional[str] = None
    plan: Optional[str] = None
    coupon_code: Optional[str] = None   # ← NEW


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: Optional[str] = None   # UUID (new flow)
    plan: Optional[str] = None      # legacy
    wallet_deducted: float
    coupon_code: Optional[str] = None
    discount_amount: float = 0.0


async def _resolve_plan(db, data, cfg: dict) -> dict:
    """Resolve plan details from plan_id (UUID) or legacy plan name."""
    plan_id = getattr(data, "plan_id", None)
    plan_name_legacy = getattr(data, "plan", None)

    if plan_id:
        plan = await db.plans.find_one({"_id": plan_id, "is_active": True})
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found or inactive")
        return {
            "plan_id": plan_id,
            "plan_key": plan.get("legacy_tier") or plan_id,
            "plan_name": plan["name"],
            "plan_price": float(plan["price"]),
            "plan_validity": plan.get("validity", "monthly"),
            "features": plan.get("features", {}),
        }
    elif plan_name_legacy in ("base", "premium"):
        price = float(cfg.get(f"{plan_name_legacy}_plan_price",
                              _DEFAULT_BASE_PRICE_RS if plan_name_legacy == "base" else _DEFAULT_PREMIUM_PRICE_RS))
        name = cfg.get(f"{plan_name_legacy}_plan_name", plan_name_legacy.capitalize() + " Plan")
        return {
            "plan_id": None,
            "plan_key": plan_name_legacy,
            "plan_name": name,
            "plan_price": price,
            "plan_validity": "monthly",
            "features": {
                "whatsapp_enabled": plan_name_legacy == "premium",
                "public_gig_enabled": False,
            },
        }
    raise HTTPException(status_code=400, detail="Invalid plan")


def _plan_duration_days(validity: str) -> int:
    return 365 if validity == "yearly" else 30


@router.get("")
async def get_wallet(current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Apply pending plan change if its date has passed
    if current_user.get("pending_plan_id") and current_user.get("pending_plan_change_at"):
        try:
            change_date = datetime.fromisoformat(current_user["pending_plan_change_at"])
            if datetime.now(timezone.utc) >= change_date:
                pending_plan = await db.plans.find_one({"_id": current_user["pending_plan_id"]})
                if pending_plan:
                    await db.users.update_one({"_id": current_user["id"]}, {"$set": {
                        "active_plan_id": pending_plan["_id"],
                        "active_plan_name": pending_plan["name"],
                        "active_plan_features": pending_plan.get("features", {}),
                        "subscription_plan": pending_plan.get("legacy_tier") or pending_plan["_id"],
                        "subscription_price": float(pending_plan["price"]),
                        "subscription_validity": pending_plan.get("validity", "monthly"),
                        "whatsapp_enabled": pending_plan.get("features", {}).get("whatsapp_enabled", False),
                        "pending_plan_id": None,
                        "pending_plan_name": None,
                        "pending_plan_change_at": None,
                    }})
        except Exception as e:
            logger.warning(f"Pending plan apply failed: {e}")

    transactions = await db.wallet_transactions.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).limit(20).to_list(20)
    for t in transactions:
        t["id"] = str(t.pop("_id"))
    return {
        "balance": current_user.get("wallet_balance", 0.0),
        "subscription_plan": current_user.get("subscription_plan", "free"),
        "active_plan_id": current_user.get("active_plan_id"),
        "active_plan_name": current_user.get("active_plan_name"),
        "subscription_price": current_user.get("subscription_price"),
        "subscription_validity": current_user.get("subscription_validity", "monthly"),
        "subscription_expires_at": current_user.get("subscription_expires_at"),
        "whatsapp_enabled": current_user.get("whatsapp_enabled", False),
        "referral_code": current_user.get("referral_code"),
        "pending_plan_id": current_user.get("pending_plan_id"),
        "pending_plan_name": current_user.get("pending_plan_name"),
        "pending_plan_change_at": current_user.get("pending_plan_change_at"),
        "transactions": transactions,
    }


@router.get("/referral-stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Return how many users were referred and total wallet credits earned from referrals."""
    db = get_db()
    referred_count = await db.users.count_documents({"referred_by": current_user["id"]})
    referral_txns = await db.wallet_transactions.find(
        {"user_id": current_user["id"], "type": "credit", "description": {"$regex": "referral", "$options": "i"}}
    ).to_list(100)
    total_earned = sum(t.get("amount", 0) for t in referral_txns)
    cfg = await _get_platform_settings(db)
    reward_per_referral = cfg.get("referral_reward", _DEFAULT_REFERRAL_REWARD)
    return {
        "referral_code": current_user.get("referral_code", ""),
        "referred_count": referred_count,
        "total_earned": total_earned,
        "reward_per_referral": reward_per_referral,
    }


@router.post("/subscribe/create-order")
async def create_subscription_order(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    cfg = await _get_platform_settings(db)
    plan_info = await _resolve_plan(db, data, cfg)

    bill_rs = plan_info["plan_price"]
    coupon_code_used = None
    discount_amount = 0.0

    # Apply coupon if provided
    if data.coupon_code:
        discounted, coupon_code_used = await _apply_coupon(db, data.coupon_code, current_user["id"], bill_rs, plan_info["plan_id"])
        discount_amount = round(bill_rs - discounted, 2)
        bill_rs = discounted

    wallet_balance = current_user.get("wallet_balance", 0.0)
    wallet_deducted = min(wallet_balance, bill_rs)
    remaining_rs = bill_rs - wallet_deducted
    remaining_paise = int(remaining_rs * 100)

    if remaining_paise == 0:
        return {
            "full_wallet_cover": True,
            "wallet_deducted": wallet_deducted,
            "remaining_to_pay": 0,
            "plan_id": plan_info["plan_id"],
            "plan": plan_info["plan_key"],
            "order": None,
            "coupon_code": coupon_code_used,
            "discount_amount": discount_amount,
        }

    _require_razorpay()
    rp = get_razorpay_client()
    try:
        order = rp.order.create({
            "amount": remaining_paise,
            "currency": "INR",
            "receipt": f"sub_{current_user['id'][:8]}_{uuid.uuid4().hex[:8]}",
            "notes": {
                "user_id": current_user["id"],
                "plan": plan_info["plan_key"],
                "plan_id": plan_info["plan_id"] or "",
                "coupon_code": coupon_code_used or "",
            }
        })
    except Exception as rp_err:
        logger.error("Razorpay order creation failed: %s", rp_err)
        raise HTTPException(status_code=503, detail=f"Payment gateway error: {rp_err}")
    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "order_created",
            "razorpay_order_id": order.get("id"),
            "razorpay_payment_id": None,
            "amount_paise": remaining_paise,
            "plan": plan_info["plan_key"],
            "plan_id": plan_info["plan_id"],
            "coupon_code": coupon_code_used,
            "discount_amount": discount_amount,
            "status": "pending",
            "detail": "Razorpay order created",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
    return {
        "full_wallet_cover": False,
        "wallet_deducted": wallet_deducted,
        "remaining_to_pay": remaining_rs,
        "plan_id": plan_info["plan_id"],
        "plan": plan_info["plan_key"],
        "order": order,
        "key_id": os.environ.get("RAZORPAY_KEY_ID"),
        "coupon_code": coupon_code_used,
        "discount_amount": discount_amount,
    }


@router.post("/subscribe/activate-wallet")
async def activate_with_wallet(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """Activate subscription when fully covered by wallet (+ optional coupon)."""
    db = get_db()
    cfg = await _get_platform_settings(db)
    plan_info = await _resolve_plan(db, data, cfg)
    bill_rs = plan_info["plan_price"]
    coupon_code_used = None
    discount_amount = 0.0

    if data.coupon_code:
        discounted, coupon_code_used = await _apply_coupon(db, data.coupon_code, current_user["id"], bill_rs, plan_info["plan_id"])
        discount_amount = round(bill_rs - discounted, 2)
        bill_rs = discounted

    wallet_balance = current_user.get("wallet_balance", 0.0)
    if wallet_balance < bill_rs:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=_plan_duration_days(plan_info["plan_validity"]))).isoformat()
    new_balance = wallet_balance - bill_rs

    user_update = {
        "wallet_balance": new_balance,
        "subscription_plan": plan_info["plan_key"],
        "active_plan_name": plan_info["plan_name"],
        "subscription_price": bill_rs,
        "subscription_validity": plan_info["plan_validity"],
        "subscription_expires_at": expires_at,
        "whatsapp_enabled": plan_info["features"].get("whatsapp_enabled", False),
        "active_plan_features": plan_info["features"],
        "pending_plan_id": None,
        "pending_plan_name": None,
        "pending_plan_change_at": None,
    }
    if plan_info["plan_id"]:
        user_update["active_plan_id"] = plan_info["plan_id"]

    await db.users.update_one({"_id": current_user["id"]}, {"$set": user_update})

    desc = f"Subscription: {plan_info['plan_name']}"
    if coupon_code_used:
        desc += f" (Coupon: {coupon_code_used}, saved ₹{discount_amount:.0f})"

    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": bill_rs,
        "description": desc,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)

    if coupon_code_used:
        await _record_coupon_redemption(db, coupon_code_used, current_user["id"], plan_info["plan_id"], discount_amount)

    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "wallet_covered",
            "razorpay_order_id": None,
            "razorpay_payment_id": None,
            "amount_paise": int(bill_rs * 100),
            "plan": plan_info["plan_key"],
            "plan_id": plan_info["plan_id"],
            "coupon_code": coupon_code_used,
            "discount_amount": discount_amount,
            "status": "success",
            "detail": f"Full wallet cover: ₹{bill_rs:.2f}",
            "created_at": now.isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
    await _check_and_reward_referrer(db, current_user)
    return {"message": "Subscription activated", "plan": plan_info["plan_key"], "expires_at": expires_at}


@router.post("/subscribe/verify")
async def verify_payment(data: VerifyPaymentRequest, current_user: dict = Depends(get_current_user)):
    _require_razorpay()
    rp = get_razorpay_client()
    db = get_db()
    now = datetime.now(timezone.utc)

    try:
        rp.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature,
        })
    except Exception:
        try:
            await db.payment_logs.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "event": "payment_failed",
                "razorpay_order_id": data.razorpay_order_id,
                "razorpay_payment_id": data.razorpay_payment_id,
                "amount_paise": None,
                "plan": getattr(data, "plan", None),
                "status": "failed",
                "detail": "Signature verification failed",
                "created_at": now.isoformat(),
            })
        except Exception as log_err:
            logger.error("payment_log write failed: %s", log_err)
        raise HTTPException(status_code=400, detail="Payment verification failed")

    cfg = await _get_platform_settings(db)
    plan_info = await _resolve_plan(db, data, cfg)

    wallet_balance = current_user.get("wallet_balance", 0.0)
    new_balance = max(0.0, wallet_balance - data.wallet_deducted)

    user_update = {
        "wallet_balance": new_balance,
        "subscription_plan": plan_info["plan_key"],
        "active_plan_name": plan_info["plan_name"],
        "subscription_price": plan_info["plan_price"],
        "subscription_validity": plan_info["plan_validity"],
        "subscription_expires_at": (now + timedelta(days=_plan_duration_days(plan_info["plan_validity"]))).isoformat(),
        "whatsapp_enabled": plan_info["features"].get("whatsapp_enabled", False),
        "active_plan_features": plan_info["features"],
        "pending_plan_id": None,
        "pending_plan_name": None,
        "pending_plan_change_at": None,
    }
    if plan_info["plan_id"]:
        user_update["active_plan_id"] = plan_info["plan_id"]

    await db.users.update_one({"_id": current_user["id"]}, {"$set": user_update})

    desc = f"Subscription: {plan_info['plan_name']} (via Razorpay)"
    if data.coupon_code:
        desc += f" (Coupon: {data.coupon_code}, saved ₹{data.discount_amount:.0f})"
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": plan_info["plan_price"],
        "description": desc,
        "reference": data.razorpay_payment_id,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
    if data.coupon_code:
        await _record_coupon_redemption(db, data.coupon_code, current_user["id"], plan_info["plan_id"], data.discount_amount)
    await _check_and_reward_referrer(db, current_user)
    await send_notification(
        db, current_user["id"], "subscription",
        "Subscription Activated!", f"Your {plan_info['plan_name']} is now active."
    )
    try:
        await db.payment_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "event": "payment_verified",
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "amount_paise": int(plan_info["plan_price"] * 100),
            "plan": plan_info["plan_key"],
            "plan_id": plan_info["plan_id"],
            "status": "success",
            "detail": f"Subscription activated: {plan_info['plan_name']}",
            "created_at": now.isoformat(),
        })
    except Exception as e:
        logger.error("payment_log write failed: %s", e)
    return {"message": "Payment verified. Subscription active!", "plan": plan_info["plan_key"], "expires_at": (datetime.now(timezone.utc) + timedelta(days=_plan_duration_days(plan_info["plan_validity"]))).isoformat()}


@router.post("/subscribe/upgrade")
async def upgrade_plan(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """
    Immediate plan upgrade with pro-rata wallet credit for unused days.
    Pro-rata = (remaining_days / plan_duration) * current_plan_price → credited to wallet.
    User is then charged new plan full price (wallet-first).
    """
    db = get_db()
    cfg = await _get_platform_settings(db)
    new_plan_info = await _resolve_plan(db, data, cfg)

    now = datetime.now(timezone.utc)
    expires_raw = current_user.get("subscription_expires_at")
    current_price = float(current_user.get("subscription_price") or 0)
    current_validity = current_user.get("subscription_validity", "monthly")
    plan_duration = _plan_duration_days(current_validity)

    # Calculate pro-rata refund
    pro_rata = 0.0
    if expires_raw and current_price > 0:
        try:
            expires_dt = datetime.fromisoformat(expires_raw)
            remaining_days = max(0, (expires_dt - now).days)
            pro_rata = round((remaining_days / plan_duration) * current_price, 2)
        except Exception:
            pass

    # Credit pro-rata to wallet
    wallet_balance = current_user.get("wallet_balance", 0.0)
    if pro_rata > 0:
        wallet_balance += pro_rata
        await db.wallet_transactions.insert_one({
            "_id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "type": "credit",
            "amount": pro_rata,
            "description": f"Pro-rata refund on upgrade to {new_plan_info['plan_name']}",
            "balance_after": wallet_balance,
            "created_at": now.isoformat(),
        })
        await db.users.update_one({"_id": current_user["id"]}, {"$set": {"wallet_balance": wallet_balance}})
        current_user["wallet_balance"] = wallet_balance

    # Now subscribe to new plan using wallet-first billing
    bill_rs = new_plan_info["plan_price"]
    wallet_deducted = min(wallet_balance, bill_rs)
    remaining_rs = bill_rs - wallet_deducted
    remaining_paise = int(remaining_rs * 100)

    if remaining_paise == 0:
        # Full wallet cover after pro-rata
        expires_at = (now + timedelta(days=_plan_duration_days(new_plan_info["plan_validity"]))).isoformat()
        new_balance = wallet_balance - wallet_deducted
        user_update = {
            "wallet_balance": new_balance,
            "subscription_plan": new_plan_info["plan_key"],
            "active_plan_name": new_plan_info["plan_name"],
            "subscription_price": bill_rs,
            "subscription_validity": new_plan_info["plan_validity"],
            "subscription_expires_at": expires_at,
            "whatsapp_enabled": new_plan_info["features"].get("whatsapp_enabled", False),
            "active_plan_features": new_plan_info["features"],
            "pending_plan_id": None, "pending_plan_name": None, "pending_plan_change_at": None,
        }
        if new_plan_info["plan_id"]:
            user_update["active_plan_id"] = new_plan_info["plan_id"]
        await db.users.update_one({"_id": current_user["id"]}, {"$set": user_update})
        await db.wallet_transactions.insert_one({
            "_id": str(uuid.uuid4()), "user_id": current_user["id"], "type": "debit",
            "amount": wallet_deducted, "description": f"Subscription upgrade: {new_plan_info['plan_name']}",
            "balance_after": new_balance, "created_at": now.isoformat(),
        })
        return {"full_wallet_cover": True, "pro_rata_credited": pro_rata, "wallet_deducted": wallet_deducted, "expires_at": expires_at}

    _require_razorpay()
    rp = get_razorpay_client()
    try:
        order = rp.order.create({
            "amount": remaining_paise, "currency": "INR",
            "receipt": f"upg_{current_user['id'][:8]}_{uuid.uuid4().hex[:8]}",
            "notes": {"user_id": current_user["id"], "plan_id": new_plan_info["plan_id"] or "", "type": "upgrade"},
        })
    except Exception as rp_err:
        logger.error("Razorpay upgrade order creation failed: %s", rp_err)
        raise HTTPException(status_code=503, detail=f"Payment gateway error: {rp_err}")
    return {
        "full_wallet_cover": False,
        "pro_rata_credited": pro_rata,
        "wallet_deducted": wallet_deducted,
        "remaining_to_pay": remaining_rs,
        "plan_id": new_plan_info["plan_id"],
        "order": order,
        "key_id": os.environ.get("RAZORPAY_KEY_ID"),
    }


@router.post("/subscribe/downgrade")
async def downgrade_plan(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """
    Schedule a plan downgrade at end of current tenure.
    No immediate charge. Stores pending_plan_id for auto-apply on tenure end.
    """
    db = get_db()
    cfg = await _get_platform_settings(db)
    new_plan_info = await _resolve_plan(db, data, cfg)

    expires_at = current_user.get("subscription_expires_at")
    if not expires_at:
        raise HTTPException(status_code=400, detail="No active subscription to schedule downgrade from")

    await db.users.update_one({"_id": current_user["id"]}, {"$set": {
        "pending_plan_id": new_plan_info["plan_id"],
        "pending_plan_name": new_plan_info["plan_name"],
        "pending_plan_change_at": expires_at,
    }})
    return {
        "message": f"Downgrade to '{new_plan_info['plan_name']}' scheduled.",
        "effective_date": expires_at,
        "pending_plan_name": new_plan_info["plan_name"],
    }


async def _check_and_reward_referrer(db, user: dict):
    """Credit referral reward to referrer on user's FIRST subscription."""
    if not user.get("referred_by"):
        return
    existing_tx = await db.wallet_transactions.find_one({
        "user_id": user["id"], "type": "debit", "description": {"$regex": "Subscription"}
    })
    if existing_tx:
        return  # Not first subscription
    referrer = await db.users.find_one({"_id": user["referred_by"]})
    if not referrer:
        return
    # Read dynamic referral reward amount from platform settings
    cfg = await _get_platform_settings(db)
    referral_reward = cfg.get("referral_reward", _DEFAULT_REFERRAL_REWARD)
    new_balance = referrer.get("wallet_balance", 0.0) + referral_reward
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": user["referred_by"]}, {"$set": {"wallet_balance": new_balance}})
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": user["referred_by"],
        "type": "credit",
        "amount": referral_reward,
        "description": f"Referral reward: {user['full_name']} subscribed",
        "balance_after": new_balance,
        "created_at": now,
    }
    await db.wallet_transactions.insert_one(tx)
    await send_notification(
        db, user["referred_by"], "wallet_credit",
        f"₹{referral_reward} Referral Reward!",
        f"Your referral {user['full_name']} just subscribed. ₹{referral_reward} added to wallet!",
        {"amount": referral_reward}
    )
