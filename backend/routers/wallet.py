import os
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

router = APIRouter(prefix="/wallet")

PLAN_PRICES = {"base": 6900, "premium": 9900}  # paise
PLAN_NAMES = {"base": "Base Plan (₹69/mo)", "premium": "Premium Plan (₹99/mo)"}
REFERRAL_REWARD = int(os.environ.get("REFERRAL_REWARD_AMOUNT", 50))


def get_razorpay_client():
    return razorpay.Client(auth=(
        os.environ.get("RAZORPAY_KEY_ID"),
        os.environ.get("RAZORPAY_KEY_SECRET")
    ))


class SubscribeRequest(BaseModel):
    plan: str  # base / premium


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str
    wallet_deducted: float


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


@router.post("/subscribe/create-order")
async def create_subscription_order(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    if data.plan not in PLAN_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan")
    db = get_db()
    bill_paise = PLAN_PRICES[data.plan]
    bill_rs = bill_paise / 100

    wallet_balance = current_user.get("wallet_balance", 0.0)
    wallet_deducted = min(wallet_balance, bill_rs)
    remaining_rs = bill_rs - wallet_deducted
    remaining_paise = int(remaining_rs * 100)

    if remaining_paise == 0:
        # Full wallet cover - no Razorpay needed
        return {
            "full_wallet_cover": True,
            "wallet_deducted": wallet_deducted,
            "remaining_to_pay": 0,
            "plan": data.plan,
            "order": None
        }

    rp = get_razorpay_client()
    order = rp.order.create({
        "amount": remaining_paise,
        "currency": "INR",
        "receipt": f"sub_{current_user['id'][:8]}_{uuid.uuid4().hex[:8]}",
        "notes": {"user_id": current_user["id"], "plan": data.plan}
    })
    return {
        "full_wallet_cover": False,
        "wallet_deducted": wallet_deducted,
        "remaining_to_pay": remaining_rs,
        "plan": data.plan,
        "order": order,
        "key_id": os.environ.get("RAZORPAY_KEY_ID")
    }


@router.post("/subscribe/activate-wallet")
async def activate_with_wallet(data: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """Activate subscription when fully covered by wallet."""
    db = get_db()
    bill_rs = PLAN_PRICES[data.plan] / 100
    wallet_balance = current_user.get("wallet_balance", 0.0)
    if wallet_balance < bill_rs:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()
    new_balance = wallet_balance - bill_rs

    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$set": {
            "wallet_balance": new_balance,
            "subscription_plan": data.plan,
            "subscription_expires_at": expires_at,
            "whatsapp_enabled": data.plan == "premium",
        }}
    )
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": bill_rs,
        "description": f"Subscription: {PLAN_NAMES[data.plan]}",
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
    await _check_and_reward_referrer(db, current_user)
    return {"message": "Subscription activated", "plan": data.plan, "expires_at": expires_at}


@router.post("/subscribe/verify")
async def verify_payment(data: VerifyPaymentRequest, current_user: dict = Depends(get_current_user)):
    rp = get_razorpay_client()
    try:
        rp.utility.verify_payment_signature({
            "razorpay_order_id": data.razorpay_order_id,
            "razorpay_payment_id": data.razorpay_payment_id,
            "razorpay_signature": data.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

    db = get_db()
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=30)).isoformat()
    wallet_balance = current_user.get("wallet_balance", 0.0)
    new_balance = max(0.0, wallet_balance - data.wallet_deducted)

    await db.users.update_one(
        {"_id": current_user["id"]},
        {"$set": {
            "wallet_balance": new_balance,
            "subscription_plan": data.plan,
            "subscription_expires_at": expires_at,
            "whatsapp_enabled": data.plan == "premium",
        }}
    )
    bill_rs = PLAN_PRICES[data.plan] / 100
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "debit",
        "amount": bill_rs,
        "description": f"Subscription: {PLAN_NAMES[data.plan]} (via Razorpay)",
        "reference": data.razorpay_payment_id,
        "balance_after": new_balance,
        "created_at": now.isoformat(),
    }
    await db.wallet_transactions.insert_one(tx)
    await _check_and_reward_referrer(db, current_user)
    await send_notification(
        db, current_user["id"], "subscription",
        "Subscription Activated!", f"Your {PLAN_NAMES[data.plan]} is now active."
    )
    return {"message": "Payment verified. Subscription active!", "plan": data.plan, "expires_at": expires_at}


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
    new_balance = referrer.get("wallet_balance", 0.0) + REFERRAL_REWARD
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": user["referred_by"]}, {"$set": {"wallet_balance": new_balance}})
    tx = {
        "_id": str(uuid.uuid4()),
        "user_id": user["referred_by"],
        "type": "credit",
        "amount": REFERRAL_REWARD,
        "description": f"Referral reward: {user['full_name']} subscribed",
        "balance_after": new_balance,
        "created_at": now,
    }
    await db.wallet_transactions.insert_one(tx)
    await send_notification(
        db, user["referred_by"], "wallet_credit",
        f"₹{REFERRAL_REWARD} Referral Reward!",
        f"Your referral {user['full_name']} just subscribed. ₹{REFERRAL_REWARD} added to wallet!",
        {"amount": REFERRAL_REWARD}
    )
