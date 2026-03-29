"""User Reports — booking history, payment history, pending payments, monthly ledger, gig expenses."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from collections import defaultdict

from db import get_db
from auth_utils import get_current_user

router = APIRouter(prefix="/reports")


def _fmt_month(iso_date: str) -> str:
    """Convert YYYY-MM-DD or ISO datetime to 'Mon YYYY' display string."""
    try:
        d = iso_date[:10]
        dt = datetime.strptime(d, "%Y-%m-%d")
        return dt.strftime("%b %Y")
    except Exception:
        return "Unknown"


def _sort_key(iso_date: str) -> str:
    try:
        return iso_date[:7]  # YYYY-MM
    except Exception:
        return ""


@router.get("/summary")
async def get_summary(current_user: dict = Depends(get_current_user)):
    """High-level stats for both freelancer and lead roles."""
    db = get_db()
    uid = current_user["id"]

    # ── As Freelancer ──────────────────────────────────────────────────────────
    fl_invites = await db.gig_invites.find(
        {"freelancer_id": uid, "status": "accepted"}, {"agreed_fee": 1, "counter_fee": 1, "proposed_fee": 1,
         "advance_paid": 1, "balance_paid": 1, "advance_amount": 1, "session_date": 1}
    ).to_list(500)

    total_bookings = len(fl_invites)
    now_ym = datetime.now(timezone.utc).strftime("%Y-%m")

    total_earned = 0.0
    pending_advance = 0.0
    pending_balance = 0.0
    this_month = 0.0

    for inv in fl_invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        bal = round(agreed - adv, 2)
        if inv.get("advance_paid"):
            total_earned += adv
            if inv.get("session_date", "")[:7] == now_ym:
                this_month += adv
        else:
            pending_advance += adv
        if inv.get("balance_paid"):
            total_earned += bal
            if inv.get("session_date", "")[:7] == now_ym:
                this_month += bal
        else:
            pending_balance += bal

    # ── As Lead ───────────────────────────────────────────────────────────────
    my_gigs = await db.gigs.find({"lead_photographer_id": uid}, {"_id": 1}).to_list(200)
    my_gig_ids = [g["_id"] for g in my_gigs]
    lead_invites = []
    if my_gig_ids:
        lead_invites = await db.gig_invites.find(
            {"gig_id": {"$in": my_gig_ids}, "status": "accepted"},
            {"agreed_fee": 1, "counter_fee": 1, "proposed_fee": 1,
             "advance_paid": 1, "balance_paid": 1, "advance_amount": 1}
        ).to_list(500)

    total_paid_to_crew = 0.0
    pending_to_crew = 0.0
    for inv in lead_invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        bal = round(agreed - adv, 2)
        if inv.get("advance_paid"):
            total_paid_to_crew += adv
        else:
            pending_to_crew += adv
        if inv.get("balance_paid"):
            total_paid_to_crew += bal
        else:
            pending_to_crew += bal

    return {
        "as_freelancer": {
            "total_bookings": total_bookings,
            "total_earned": round(total_earned, 2),
            "pending_advance": round(pending_advance, 2),
            "pending_balance": round(pending_balance, 2),
            "this_month_earned": round(this_month, 2),
        },
        "as_lead": {
            "total_gigs": len(my_gigs),
            "total_paid_to_crew": round(total_paid_to_crew, 2),
            "pending_to_crew": round(pending_to_crew, 2),
        },
    }


@router.get("/bookings")
async def get_booking_history(current_user: dict = Depends(get_current_user)):
    """All accepted gig invites as freelancer."""
    db = get_db()
    invites = await db.gig_invites.find(
        {"freelancer_id": current_user["id"], "status": "accepted"}
    ).sort("session_date", -1).to_list(200)

    gig_ids = list({inv["gig_id"] for inv in invites})
    gigs_raw = await db.gigs.find({"_id": {"$in": gig_ids}}, {"title": 1, "lead_photographer_id": 1}).to_list(200)
    gig_map = {g["_id"]: g for g in gigs_raw}

    lead_ids = list({g.get("lead_photographer_id") for g in gigs_raw if g.get("lead_photographer_id")})
    leads_raw = await db.users.find({"_id": {"$in": lead_ids}}, {"full_name": 1, "phone": 1}).to_list(100)
    lead_map = {u["_id"]: u for u in leads_raw}

    result = []
    for inv in invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        gig = gig_map.get(inv["gig_id"], {})
        lead = lead_map.get(gig.get("lead_photographer_id", ""), {})
        result.append({
            "invite_id": inv["_id"],
            "gig_id": inv["gig_id"],
            "gig_title": gig.get("title", "Unknown"),
            "lead_name": lead.get("full_name", "Unknown"),
            "role": inv.get("role", ""),
            "session_date": inv.get("session_date", ""),
            "agreed_fee": agreed,
            "advance_amount": adv,
            "balance_amount": round(agreed - adv, 2),
            "advance_paid": inv.get("advance_paid", False),
            "balance_paid": inv.get("balance_paid", False),
            "advance_paid_at": inv.get("advance_paid_at"),
            "balance_paid_at": inv.get("balance_paid_at"),
        })
    return result


@router.get("/payments")
async def get_payment_history(current_user: dict = Depends(get_current_user)):
    """Payments actually received (advance + balance settled)."""
    db = get_db()
    invites = await db.gig_invites.find(
        {
            "freelancer_id": current_user["id"],
            "status": "accepted",
            "$or": [{"advance_paid": True}, {"balance_paid": True}]
        }
    ).sort("session_date", -1).to_list(200)

    gig_ids = list({inv["gig_id"] for inv in invites})
    gigs_raw = await db.gigs.find({"_id": {"$in": gig_ids}}, {"title": 1}).to_list(200)
    gig_map = {g["_id"]: g for g in gigs_raw}

    records = []
    for inv in invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        gig_title = gig_map.get(inv["gig_id"], {}).get("title", "Unknown")
        if inv.get("advance_paid"):
            records.append({
                "type": "Advance",
                "amount": adv,
                "gig_title": gig_title,
                "role": inv.get("role", ""),
                "session_date": inv.get("session_date", ""),
                "paid_at": inv.get("advance_paid_at"),
            })
        if inv.get("balance_paid"):
            records.append({
                "type": "Balance",
                "amount": round(agreed - adv, 2),
                "gig_title": gig_title,
                "role": inv.get("role", ""),
                "session_date": inv.get("session_date", ""),
                "paid_at": inv.get("balance_paid_at"),
            })

    records.sort(key=lambda x: x.get("paid_at") or "", reverse=True)
    return records


@router.get("/pending")
async def get_pending_payments(current_user: dict = Depends(get_current_user)):
    """Accepted bookings where advance or balance is still unpaid."""
    db = get_db()
    invites = await db.gig_invites.find(
        {
            "freelancer_id": current_user["id"],
            "status": "accepted",
            "$or": [{"advance_paid": {"$ne": True}}, {"balance_paid": {"$ne": True}}]
        }
    ).sort("session_date", 1).to_list(200)

    gig_ids = list({inv["gig_id"] for inv in invites})
    gigs_raw = await db.gigs.find({"_id": {"$in": gig_ids}}, {"title": 1, "lead_photographer_id": 1}).to_list(200)
    gig_map = {g["_id"]: g for g in gigs_raw}
    lead_ids = list({g.get("lead_photographer_id") for g in gigs_raw if g.get("lead_photographer_id")})
    leads_raw = await db.users.find({"_id": {"$in": lead_ids}}, {"full_name": 1, "phone": 1, "whatsapp_number": 1}).to_list(100)
    lead_map = {u["_id"]: u for u in leads_raw}

    result = []
    for inv in invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        bal = round(agreed - adv, 2)
        gig = gig_map.get(inv["gig_id"], {})
        lead = lead_map.get(gig.get("lead_photographer_id", ""), {})
        pending_amount = (adv if not inv.get("advance_paid") else 0) + (bal if not inv.get("balance_paid") else 0)
        result.append({
            "invite_id": inv["_id"],
            "gig_id": inv["gig_id"],
            "gig_title": gig.get("title", "Unknown"),
            "lead_name": lead.get("full_name", "Unknown"),
            "lead_phone": lead.get("whatsapp_number") or lead.get("phone", ""),
            "role": inv.get("role", ""),
            "session_date": inv.get("session_date", ""),
            "agreed_fee": agreed,
            "advance_pending": not inv.get("advance_paid", False),
            "advance_amount": adv,
            "balance_pending": not inv.get("balance_paid", False),
            "balance_amount": bal,
            "total_pending": round(pending_amount, 2),
        })
    result.sort(key=lambda x: x["total_pending"], reverse=True)
    return result


@router.get("/monthly")
async def get_monthly_ledger(current_user: dict = Depends(get_current_user)):
    """Earned amounts grouped by month (as freelancer)."""
    db = get_db()
    invites = await db.gig_invites.find(
        {"freelancer_id": current_user["id"], "status": "accepted"},
        {"agreed_fee": 1, "counter_fee": 1, "proposed_fee": 1,
         "advance_paid": 1, "balance_paid": 1, "advance_amount": 1,
         "advance_paid_at": 1, "balance_paid_at": 1, "session_date": 1}
    ).to_list(500)

    monthly: dict = defaultdict(lambda: {"earned": 0.0, "pending": 0.0, "bookings": 0})

    for inv in invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        bal = round(agreed - adv, 2)
        # Key by session month for bookings, payment month for earnings
        month_key = inv.get("session_date", "")[:7] or "unknown"
        monthly[month_key]["bookings"] += 1
        if inv.get("advance_paid"):
            paid_month = (inv.get("advance_paid_at") or inv.get("session_date", ""))[:7]
            monthly[paid_month]["earned"] += adv
        else:
            monthly[month_key]["pending"] += adv
        if inv.get("balance_paid"):
            paid_month = (inv.get("balance_paid_at") or inv.get("session_date", ""))[:7]
            monthly[paid_month]["earned"] += bal
        else:
            monthly[month_key]["pending"] += bal

    rows = []
    for ym, data in sorted(monthly.items(), reverse=True):
        rows.append({
            "month_key": ym,
            "month_label": _fmt_month(ym + "-01"),
            "bookings": data["bookings"],
            "earned": round(data["earned"], 2),
            "pending": round(data["pending"], 2),
        })
    return rows


@router.get("/gig-expenses")
async def get_gig_expenses(current_user: dict = Depends(get_current_user)):
    """As gig lead — crew payment breakdown for all my gigs."""
    db = get_db()
    my_gigs = await db.gigs.find(
        {"lead_photographer_id": current_user["id"]},
        {"_id": 1, "title": 1}
    ).sort("created_at", -1).to_list(100)

    if not my_gigs:
        return []

    my_gig_ids = [g["_id"] for g in my_gigs]
    gig_map = {g["_id"]: g["title"] for g in my_gigs}

    invites = await db.gig_invites.find(
        {"gig_id": {"$in": my_gig_ids}, "status": "accepted"}
    ).to_list(500)

    fl_ids = list({inv["freelancer_id"] for inv in invites})
    fl_raw = await db.users.find({"_id": {"$in": fl_ids}}, {"full_name": 1, "phone": 1}).to_list(100)
    fl_map = {f["_id"]: f for f in fl_raw}

    # Group by gig
    gig_expenses: dict = defaultdict(lambda: {"gig_title": "", "entries": [], "total": 0.0, "paid": 0.0, "pending": 0.0})

    for inv in invites:
        agreed = inv.get("agreed_fee") or inv.get("counter_fee") or inv.get("proposed_fee", 0)
        adv = inv.get("advance_amount", round(agreed * 0.5, 2))
        bal = round(agreed - adv, 2)
        paid = (adv if inv.get("advance_paid") else 0) + (bal if inv.get("balance_paid") else 0)
        pending = agreed - paid
        fl = fl_map.get(inv["freelancer_id"], {})
        gid = inv["gig_id"]
        gig_expenses[gid]["gig_title"] = gig_map.get(gid, "Unknown")
        gig_expenses[gid]["gig_id"] = gid
        gig_expenses[gid]["total"] += agreed
        gig_expenses[gid]["paid"] += paid
        gig_expenses[gid]["pending"] += pending
        gig_expenses[gid]["entries"].append({
            "invite_id": inv["_id"],
            "freelancer_name": fl.get("full_name", "Unknown"),
            "role": inv.get("role", ""),
            "session_date": inv.get("session_date", ""),
            "agreed_fee": agreed,
            "advance_paid": inv.get("advance_paid", False),
            "balance_paid": inv.get("balance_paid", False),
            "paid": round(paid, 2),
            "pending": round(pending, 2),
        })

    result = []
    for gid, data in gig_expenses.items():
        result.append({
            "gig_id": gid,
            "gig_title": data["gig_title"],
            "team_size": len(data["entries"]),
            "total_crew_fees": round(data["total"], 2),
            "total_paid": round(data["paid"], 2),
            "total_pending": round(data["pending"], 2),
            "entries": data["entries"],
        })
    result.sort(key=lambda x: x["total_pending"], reverse=True)
    return result
