"""
Gig completion milestone rewards.
Milestones: 5, 10, 25, 50, 100 completed gigs.
"""
from datetime import datetime, timezone
import uuid
from services.notifications_service import send_notification

MILESTONE_REWARDS = [(5, 100), (10, 250), (25, 500), (50, 1000), (100, 2500)]


async def check_and_award_milestones(db, lead_id: str):
    """Award wallet credit when a lead photographer hits a gig milestone."""
    completed_count = await db.gigs.count_documents({
        "lead_photographer_id": lead_id,
        "status": "completed"
    })

    for milestone, reward in MILESTONE_REWARDS:
        if completed_count == milestone:
            # Idempotency: check if already awarded
            existing = await db.wallet_transactions.find_one({
                "user_id": lead_id,
                "description": {"$regex": f"Milestone: {milestone} gigs"}
            })
            if existing:
                return

            user = await db.users.find_one({"_id": lead_id})
            if not user:
                return

            new_balance = round(user.get("wallet_balance", 0.0) + reward, 2)
            now = datetime.now(timezone.utc).isoformat()

            await db.users.update_one({"_id": lead_id}, {"$set": {"wallet_balance": new_balance}})
            await db.wallet_transactions.insert_one({
                "_id": str(uuid.uuid4()),
                "user_id": lead_id,
                "type": "credit",
                "amount": reward,
                "description": f"Milestone: {milestone} gigs completed!",
                "balance_after": new_balance,
                "created_at": now,
            })
            await send_notification(
                db, lead_id, "wallet_credit",
                f"Milestone Reward: {milestone} Gigs!",
                f"Amazing! You've completed {milestone} gigs. ₹{reward} credited to your wallet!",
                {"milestone": milestone, "reward": reward}
            )
            break  # One milestone per check
