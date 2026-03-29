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


def get_razorpay_client():
    return razorpay.Client(auth=(
        os.environ.get("RAZORPAY_KEY_ID"),
        os.environ.get("RAZORPAY_KEY_SECRET")
    ))


class SubscribeRequest(BaseModel):
    plan_id: Optional[str] = None   # UUID from DB plans collection (new flow)
    plan: Optional[str] = None      # "base" / "premium" (legacy fallback)


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: Optional[str] = None   # UUID (new flow)
    plan: Optional[str] = None      # legacy
    wallet_deducted: float


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
            "features": {
                "whatsapp_enabled": plan_name_legacy == "premium",
                "public_gig_enabled": False,
            },
        }
    raise HTTPException(status_code=400, detail="Invalid plan")


@router.get("")
async def get_wallet(current_user: dict = Depends(get_current_user)):
    db = get_db()
    transactions = await db.wallet_transactions.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).limit(20).to_list(20)
    for t in transactions:
        t["id"] = str(t.pop("_id"))
    return {
        "balance": current_user.get("wallet_balance", 0.0),
        "subscription_plan": current_user.get("subscription_plan", "free"),
        "subscription_expires_at": current_user.get("subscription_expires_at"),
        "whatsapp_enabled": current_user.get("whatsapp_enabled", False),
        "referral_code": current_user.get("referral_code"),
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
            "order": None
        }

    rp = get_razorpay_client()
    order = rp.order.create({
        "amount": remaining_paise,
        "currency": "INR",
        "receipt": f"sub_{current_user['id'][:8]}_{uuid.uuid4().hex[:8]}",
        "notes": {
            "user_id": current_user["id"],
            "plan": plan_info["plan_key"],
            "plan_id": plan_info["plan_id"] or "",
        }
    })
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
        "key_id": os.environ.get("RAZORPAY_KEY_ID")
    }


@router.post("/subscribe/activate-wallet")
async def activate_with_wallet(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """Activate subscription when fully covered by wallet."""
    db = get_db()
    cfg = await _get_platform_settings(db)
    plan_info = await _resolve_plan(db, data, cfg)
    bill_rs = plan_info["plan_price"]

    wallet_balance = current_user.get("wallet_balance", 0.0)
    if wallet_balance < bill_rs:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()
    new_balance = wallet_balance - bill_rs

    user_update = {
        "wallet_balance": new_balance,
        "subscription_plan": plan_info["plan_key"],
        "subscription_expires_at": expires_at,
        "whatsapp_enabled": plan_info["features"].get("whatsapp_enabled", False),
        "active_plan_features": plan_info["features"],
    }
    if plan_info["plan_id"]:
        user_update["active_plan_id"] = plan_info["plan_id"]

    await db.users.update_one({"_id": current_user["id"]}, {"$set": user_update})
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": bill_rs,
        "description": f"Subscription: {plan_info['plan_name']}",
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
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
    rp = get_razorpay_client()
    db = get_db()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()

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
        "subscription_expires_at": expires_at,
        "whatsapp_enabled": plan_info["features"].get("whatsapp_enabled", False),
        "active_plan_features": plan_info["features"],
    }
    if plan_info["plan_id"]:
        user_update["active_plan_id"] = plan_info["plan_id"]

    await db.users.update_one({"_id": current_user["id"]}, {"$set": user_update})
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": plan_info["plan_price"],
        "description": f"Subscription: {plan_info['plan_name']} (via Razorpay)",
        "reference": data.razorpay_payment_id,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
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
    return {"message": "Payment verified. Subscription active!", "plan": plan_info["plan_key"], "expires_at": expires_at}


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
