#!/usr/bin/env python3
"""
CrewBook — Sample Data Seeder
=================================
Inserts realistic demo data into the database.

Usage:
    python seed_data.py                             # uses MONGO_URL + DB_NAME from env
    MONGO_URL=mongodb://localhost:27017 python seed_data.py
    docker compose exec backend python /app/scripts/seed_data.py

Credentials after seeding:
    admin@crewbook.in   / Admin@123
    rohan@example.com   / Test@1234   (Lead Photographer)
    priya@example.com   / Test@1234   (Second Shooter)
    aakash@example.com  / Test@1234   (Videographer)
    kavya@example.com   / Test@1234   (Drone Operator)
    vikram@example.com  / Test@1234   (Photo Assistant)
"""

import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

# Load .env from parent directory (backend/.env) if present
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, "..", "backend", ".env"))

try:
    from pymongo import MongoClient
    import logging as _logging
    _logging.getLogger("passlib").setLevel(_logging.ERROR)  # suppress bcrypt version warning
    from passlib.context import CryptContext
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install pymongo passlib bcrypt python-dotenv")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "crewbook_db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pw(password: str) -> str:
    return pwd_context.hash(password)


def now_iso(offset_days: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=offset_days)).isoformat()


# ── Colours ────────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RED    = "\033[91m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✓{RESET}  {msg}")
def skip(msg): print(f"  {YELLOW}↷{RESET}  {msg} (already exists — skipped)")
def info(msg): print(f"  {CYAN}→{RESET}  {msg}")
def err(msg):  print(f"  {RED}✗{RESET}  {msg}")


# ── IDs (stable so re-runs stay idempotent) ────────────────────────────────────
ID = {
    "admin":   "usr-admin-00000000-0000-0000-0000-000000000001",
    "rohan":   "usr-rohan-00000000-0000-0000-0000-000000000002",
    "priya":   "usr-priya-00000000-0000-0000-0000-000000000003",
    "aakash":  "usr-aakash-0000000-0000-0000-0000-000000000004",
    "kavya":   "usr-kavya-00000000-0000-0000-0000-000000000005",
    "vikram":  "usr-vikram-0000000-0000-0000-0000-000000000006",
    "plan_basic": "plan-basic-000000-0000-0000-0000-000000000001",
    "plan_pro":   "plan-pro-0000000-0000-0000-0000-000000000002",
    "gig_wedding":   "gig-wedding-0000-0000-0000-0000-000000000001",
    "gig_portrait":  "gig-portrait-000-0000-0000-0000-000000000002",
    "invite_priya":  "inv-priya-00000-0000-0000-0000-000000000001",
    "invite_aakash": "inv-aakash-0000-0000-0000-0000-000000000002",
    "invite_kavya":  "inv-kavya-00000-0000-0000-0000-000000000003",
    "conn_rohan_priya": "conn-rp-00000-0000-0000-0000-000000000001",
    "conn_rohan_aakash":"conn-ra-00000-0000-0000-0000-000000000002",
    "public_gig":    "pgig-000000000-0000-0000-0000-000000000001",
    "coupon_welcome": "cpn-welcome-000-0000-0000-0000-000000000001",
    "coupon_crew":    "cpn-crew-000000-0000-0000-0000-000000000002",
}


def seed_users(db):
    print(f"\n{BOLD}── Users ─────────────────────────────────────{RESET}")
    users = [
        {
            "_id": ID["admin"],
            "email": "admin@crewbook.in",
            "password_hash": hash_pw("Admin@123"),
            "full_name": "CrewBook Admin",
            "phone": "9999999999",
            "location": "Mumbai",
            "pincode": "400001",
            "primary_role": "Admin",
            "is_admin": True,
            "is_verified": True,
            "verification_status": "approved",
            "subscription_plan": "premium",
            "wallet_balance": 0.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": False,
            "referral_code": "ADMIN001",
            "gear_vault": [],
            "style_tags": [],
            "editing_ecosystem": [],
            "onboarding_complete": True,
            "total_ratings": 0,
            "avg_rating": None,
            "created_at": now_iso(-60),
            "updated_at": now_iso(-60),
        },
        {
            "_id": ID["rohan"],
            "email": "rohan@example.com",
            "password_hash": hash_pw("Test@1234"),
            "full_name": "Rohan Sharma",
            "phone": "9876543210",
            "location": "Mumbai",
            "pincode": "400053",
            "bio": "Wedding & portrait photographer with 8 years of experience. Love capturing authentic moments.",
            "primary_role": "Lead Photographer",
            "primary_day_rate": 15000,
            "secondary_role": "Photo Editor",
            "secondary_day_rate": 8000,
            "is_admin": False,
            "is_verified": True,
            "verification_status": "approved",
            "subscription_plan": "premium",
            "active_plan_name": "Pro",
            "wallet_balance": 2500.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": False,
            "referral_code": "ROHAN001",
            "upi_id": "rohan.sharma@okicici",
            "instagram_url": "https://instagram.com/rohanphotography",
            "website_url": "https://rohansharma.photography",
            "gear_vault": [
                {"category": "Camera", "name": "Sony A7 IV", "owned": True},
                {"category": "Lens", "name": "Sony 24-70mm f/2.8 GM", "owned": True},
                {"category": "Lens", "name": "Sony 85mm f/1.4 GM", "owned": True},
                {"category": "Lighting", "name": "Godox AD600 Pro", "owned": True},
            ],
            "style_tags": ["Candid", "Cinematic", "Golden Hour"],
            "editing_ecosystem": ["Lightroom", "Photoshop"],
            "onboarding_complete": True,
            "total_ratings": 2,
            "avg_rating": 4.67,
            "created_at": now_iso(-50),
            "updated_at": now_iso(-2),
        },
        {
            "_id": ID["priya"],
            "email": "priya@example.com",
            "password_hash": hash_pw("Test@1234"),
            "full_name": "Priya Patel",
            "phone": "9876543211",
            "location": "Mumbai",
            "pincode": "400070",
            "bio": "Candid second shooter. I specialize in getting those off-guard moments that make memories.",
            "primary_role": "Second Shooter",
            "primary_day_rate": 8000,
            "is_admin": False,
            "is_verified": True,
            "verification_status": "approved",
            "subscription_plan": "base",
            "active_plan_name": "Basic",
            "wallet_balance": 8000.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": False,
            "referral_code": "PRIYA001",
            "upi_id": "priya.patel@oksbi",
            "instagram_url": "https://instagram.com/priyacandid",
            "gear_vault": [
                {"category": "Camera", "name": "Canon R6 Mark II", "owned": True},
                {"category": "Lens", "name": "Canon 50mm f/1.2L", "owned": True},
            ],
            "style_tags": ["Candid", "Documentary"],
            "editing_ecosystem": ["Lightroom"],
            "onboarding_complete": True,
            "total_ratings": 1,
            "avg_rating": 4.67,
            "created_at": now_iso(-45),
            "updated_at": now_iso(-2),
        },
        {
            "_id": ID["aakash"],
            "email": "aakash@example.com",
            "password_hash": hash_pw("Test@1234"),
            "full_name": "Aakash Mehta",
            "phone": "9876543212",
            "location": "Delhi",
            "pincode": "110001",
            "bio": "Cinematic wedding videographer. I create films that you will watch over and over again.",
            "primary_role": "Videographer",
            "primary_day_rate": 18000,
            "is_admin": False,
            "is_verified": True,
            "verification_status": "approved",
            "subscription_plan": "premium",
            "active_plan_name": "Pro",
            "wallet_balance": 12000.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": False,
            "referral_code": "AAKASH01",
            "upi_id": "aakash.mehta@ybl",
            "gear_vault": [
                {"category": "Camera", "name": "Sony FX3", "owned": True},
                {"category": "Lens", "name": "Sony 16-35mm f/2.8 GM", "owned": True},
                {"category": "Stabilizer", "name": "DJI RS 3 Pro", "owned": True},
            ],
            "style_tags": ["Cinematic", "Documentary"],
            "editing_ecosystem": ["Premiere Pro", "DaVinci Resolve"],
            "onboarding_complete": True,
            "total_ratings": 1,
            "avg_rating": 4.67,
            "created_at": now_iso(-40),
            "updated_at": now_iso(-3),
        },
        {
            "_id": ID["kavya"],
            "email": "kavya@example.com",
            "password_hash": hash_pw("Test@1234"),
            "full_name": "Kavya Singh",
            "phone": "9876543213",
            "location": "Bangalore",
            "pincode": "560001",
            "bio": "FAA-certified drone pilot. I bring the aerial perspective to weddings and events.",
            "primary_role": "Drone Operator",
            "primary_day_rate": 12000,
            "is_admin": False,
            "is_verified": False,
            "verification_status": "pending",
            "subscription_plan": "base",
            "active_plan_name": "Basic",
            "wallet_balance": 0.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": True,
            "referral_code": "KAVYA001",
            "gear_vault": [
                {"category": "Drone", "name": "DJI Mavic 3 Pro", "owned": True},
            ],
            "style_tags": ["Aerial", "Cinematic"],
            "editing_ecosystem": ["DaVinci Resolve"],
            "onboarding_complete": True,
            "total_ratings": 0,
            "avg_rating": None,
            "created_at": now_iso(-30),
            "updated_at": now_iso(-1),
        },
        {
            "_id": ID["vikram"],
            "email": "vikram@example.com",
            "password_hash": hash_pw("Test@1234"),
            "full_name": "Vikram Joshi",
            "phone": "9876543214",
            "location": "Pune",
            "pincode": "411001",
            "bio": "Photo assistant and budding photographer. Quick learner, reliable, always on time.",
            "primary_role": "Photo Assistant",
            "primary_day_rate": 3500,
            "is_admin": False,
            "is_verified": False,
            "verification_status": "none",
            "subscription_plan": "base",
            "active_plan_name": "Basic",
            "wallet_balance": 0.0,
            "negative_stars": 0,
            "is_suspended": False,
            "is_ghost_mode": False,
            "is_standby": False,
            "referral_code": "VIKRAM01",
            "gear_vault": [],
            "style_tags": ["Portrait", "Fashion"],
            "editing_ecosystem": ["Lightroom"],
            "onboarding_complete": True,
            "total_ratings": 0,
            "avg_rating": None,
            "created_at": now_iso(-20),
            "updated_at": now_iso(-5),
        },
    ]

    inserted = 0
    for user in users:
        # Check by BOTH _id and email (email has unique index)
        if db.users.find_one({"$or": [{"_id": user["_id"]}, {"email": user["email"]}]}):
            skip(f'{user["full_name"]} ({user["email"]})')
        else:
            db.users.insert_one(user)
            ok(f'{user["full_name"]} ({user["email"]})')
            inserted += 1

    info(f"{inserted} new user(s) inserted")


def seed_plans(db):
    print(f"\n{BOLD}── Subscription Plans ────────────────────────{RESET}")
    plans = [
        {
            "_id": ID["plan_basic"],
            "name": "Basic",
            "price": 69.0,
            "description": "Essential tools for independent photographers",
            "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
            "validity": "monthly",
            "legacy_tier": "base",
            "is_active": True,
            "sort_order": 1,
            "subscriber_count": 0,
            "created_at": now_iso(-60),
            "updated_at": now_iso(-60),
        },
        {
            "_id": ID["plan_pro"],
            "name": "Pro",
            "price": 99.0,
            "description": "Everything in Basic + Public Gig Board access + WhatsApp notifications",
            "features": {"public_gig_enabled": True, "whatsapp_enabled": True},
            "validity": "monthly",
            "legacy_tier": "premium",
            "is_active": True,
            "sort_order": 2,
            "subscriber_count": 0,
            "created_at": now_iso(-60),
            "updated_at": now_iso(-60),
        },
    ]
    for plan in plans:
        if db.plans.find_one({"_id": plan["_id"]}):
            skip(f'Plan: {plan["name"]} (₹{plan["price"]}/month)')
        else:
            db.plans.insert_one(plan)
            ok(f'Plan: {plan["name"]} (₹{plan["price"]}/month)')


def seed_gigs(db):
    print(f"\n{BOLD}── Gigs ──────────────────────────────────────{RESET}")
    gigs = [
        {
            "_id": ID["gig_wedding"],
            "title": "Sharma–Mehta Wedding — Udaipur",
            "description": "3-day destination wedding at Taj Lake Palace. Requires candid + portrait coverage.",
            "client_name": "Arjun Sharma",
            "event_type": "Wedding",
            "location": "Udaipur, Rajasthan",
            "lead_photographer_id": ID["rohan"],
            "status": "completed",
            "sessions": [
                {
                    "session_id": str(uuid.uuid4()),
                    "date": now_iso(-10)[:10],
                    "start_time": "09:00",
                    "end_time": "13:00",
                    "description": "Mehendi & Haldi ceremony",
                    "location": "Hotel Garden",
                },
                {
                    "session_id": str(uuid.uuid4()),
                    "date": now_iso(-9)[:10],
                    "start_time": "18:00",
                    "end_time": "23:59",
                    "description": "Sangeet night",
                    "location": "Rooftop venue",
                },
                {
                    "session_id": str(uuid.uuid4()),
                    "date": now_iso(-8)[:10],
                    "start_time": "10:00",
                    "end_time": "22:00",
                    "description": "Wedding ceremony + reception",
                    "location": "Taj Lake Palace",
                },
            ],
            "total_budget": 85000,
            "created_at": now_iso(-30),
            "updated_at": now_iso(-8),
        },
        {
            "_id": ID["gig_portrait"],
            "title": "Kapoor Family Portrait Session",
            "description": "Multi-generational family portrait session at a heritage bungalow.",
            "client_name": "Sunita Kapoor",
            "event_type": "Portrait",
            "location": "Bandra, Mumbai",
            "lead_photographer_id": ID["rohan"],
            "status": "active",
            "sessions": [
                {
                    "session_id": str(uuid.uuid4()),
                    "date": now_iso(7)[:10],
                    "start_time": "07:00",
                    "end_time": "10:00",
                    "description": "Golden hour family portraits",
                    "location": "Heritage bungalow — Bandra West",
                },
            ],
            "total_budget": 25000,
            "created_at": now_iso(-5),
            "updated_at": now_iso(-1),
        },
    ]
    for gig in gigs:
        if db.gigs.find_one({"_id": gig["_id"]}):
            skip(f'Gig: {gig["title"]} [{gig["status"]}]')
        else:
            db.gigs.insert_one(gig)
            ok(f'Gig: {gig["title"]} [{gig["status"]}]')


def seed_invites(db):
    print(f"\n{BOLD}── Invites ───────────────────────────────────{RESET}")
    invites = [
        {
            "_id": ID["invite_priya"],
            "gig_id": ID["gig_wedding"],
            "lead_id": ID["rohan"],
            "freelancer_id": ID["priya"],
            "role": "Second Shooter",
            "proposed_fee": 8000,
            "final_fee": 8000,
            "status": "accepted",
            "session_date": now_iso(-10)[:10],
            "session_start": "09:00",
            "session_end": "23:59",
            "invite_viewed_at": now_iso(-28),
            "advance_paid": True,
            "advance_amount": 4000,
            "balance_paid": True,
            "balance_amount": 4000,
            "created_at": now_iso(-28),
            "updated_at": now_iso(-8),
        },
        {
            "_id": ID["invite_aakash"],
            "gig_id": ID["gig_wedding"],
            "lead_id": ID["rohan"],
            "freelancer_id": ID["aakash"],
            "role": "Videographer",
            "proposed_fee": 18000,
            "final_fee": 18000,
            "status": "accepted",
            "session_date": now_iso(-9)[:10],
            "session_start": "18:00",
            "session_end": "23:59",
            "invite_viewed_at": now_iso(-27),
            "advance_paid": True,
            "advance_amount": 9000,
            "balance_paid": True,
            "balance_amount": 9000,
            "created_at": now_iso(-27),
            "updated_at": now_iso(-8),
        },
        {
            "_id": ID["invite_kavya"],
            "gig_id": ID["gig_portrait"],
            "lead_id": ID["rohan"],
            "freelancer_id": ID["kavya"],
            "role": "Drone Operator",
            "proposed_fee": 5000,
            "final_fee": None,
            "status": "pending",
            "session_date": now_iso(7)[:10],
            "session_start": "07:00",
            "session_end": "10:00",
            "invite_viewed_at": None,
            "advance_paid": False,
            "balance_paid": False,
            "created_at": now_iso(-1),
            "updated_at": now_iso(-1),
        },
    ]
    for inv in invites:
        if db.gig_invites.find_one({"_id": inv["_id"]}):
            skip(f'Invite: {inv["role"]} for gig [{inv["status"]}]')
        else:
            db.gig_invites.insert_one(inv)
            ok(f'Invite: {inv["role"]} ({inv["status"]})')


def seed_ratings(db):
    print(f"\n{BOLD}── Ratings ───────────────────────────────────{RESET}")
    ratings = [
        # Rohan rates Priya
        {
            "_id": "rat-rohan-priya-0000-0000-0000-000000000001",
            "gig_id": ID["gig_wedding"],
            "gig_title": "Sharma–Mehta Wedding — Udaipur",
            "rater_id": ID["rohan"],
            "rated_user_id": ID["priya"],
            "punctuality": 5,
            "gear_handling": 4,
            "teamwork": 5,
            "avg_score": 4.67,
            "notes": "Priya was exceptional — arrived 30 mins early and her candid shots were stunning.",
            "created_at": now_iso(-7),
        },
        # Rohan rates Aakash
        {
            "_id": "rat-rohan-aakash-000-0000-0000-000000000002",
            "gig_id": ID["gig_wedding"],
            "gig_title": "Sharma–Mehta Wedding — Udaipur",
            "rater_id": ID["rohan"],
            "rated_user_id": ID["aakash"],
            "punctuality": 4,
            "gear_handling": 5,
            "teamwork": 5,
            "avg_score": 4.67,
            "notes": "Aakash's gear handling is top-notch. Some delay on day 2 but compensated well.",
            "created_at": now_iso(-7),
        },
        # Priya rates Rohan
        {
            "_id": "rat-priya-rohan-0000-0000-0000-000000000003",
            "gig_id": ID["gig_wedding"],
            "gig_title": "Sharma–Mehta Wedding — Udaipur",
            "rater_id": ID["priya"],
            "rated_user_id": ID["rohan"],
            "punctuality": 5,
            "gear_handling": 5,
            "teamwork": 5,
            "avg_score": 5.0,
            "notes": "Rohan is an incredible lead — very organized and communicates well.",
            "created_at": now_iso(-7),
        },
        # Aakash rates Rohan
        {
            "_id": "rat-aakash-rohan-000-0000-0000-000000000004",
            "gig_id": ID["gig_wedding"],
            "gig_title": "Sharma–Mehta Wedding — Udaipur",
            "rater_id": ID["aakash"],
            "rated_user_id": ID["rohan"],
            "punctuality": 4,
            "gear_handling": 4,
            "teamwork": 5,
            "avg_score": 4.33,
            "notes": "Good lead. Shot list was detailed but schedule was slightly tight on day 3.",
            "created_at": now_iso(-7),
        },
    ]

    for rat in ratings:
        if db.ratings.find_one({"_id": rat["_id"]}):
            skip(f'Rating: {rat["rater_id"][:20]} → {rat["rated_user_id"][:20]}')
        else:
            db.ratings.insert_one(rat)
            ok(f'Rating: avg {rat["avg_score"]} (rater → rated)')

    # Update aggregate ratings on user documents
    _update_avg(db, ID["rohan"], [(5.0, "priya"), (4.33, "aakash")])   # 4.67
    _update_avg(db, ID["priya"], [(4.67, "rohan")])
    _update_avg(db, ID["aakash"], [(4.67, "rohan")])
    info("Aggregate avg_rating updated on users")


def _update_avg(db, user_id: str, scores_with_rater: list):
    all_ratings = list(db.ratings.find({"rated_user_id": user_id}))
    if not all_ratings:
        return
    total_avg = round(sum(r["avg_score"] for r in all_ratings) / len(all_ratings), 2)
    db.users.update_one(
        {"_id": user_id},
        {"$set": {"avg_rating": total_avg, "total_ratings": len(all_ratings)}},
    )


def seed_connections(db):
    print(f"\n{BOLD}── Connections ───────────────────────────────{RESET}")
    connections = [
        {
            "_id": ID["conn_rohan_priya"],
            "requester_id": ID["rohan"],
            "recipient_id": ID["priya"],
            "status": "accepted",
            "created_at": now_iso(-45),
            "updated_at": now_iso(-44),
        },
        {
            "_id": ID["conn_rohan_aakash"],
            "requester_id": ID["rohan"],
            "recipient_id": ID["aakash"],
            "status": "accepted",
            "created_at": now_iso(-40),
            "updated_at": now_iso(-39),
        },
    ]
    for conn in connections:
        if db.connections.find_one({"_id": conn["_id"]}):
            skip(f'Connection: {conn["requester_id"][:12]} ↔ {conn["recipient_id"][:12]} [{conn["status"]}]')
        else:
            db.connections.insert_one(conn)
            ok(f'Connection: {conn["requester_id"][:12]} ↔ {conn["recipient_id"][:12]} [{conn["status"]}]')


def seed_public_gig(db):
    print(f"\n{BOLD}── Public Gig Board ──────────────────────────{RESET}")
    pub_gig = {
        "_id": ID["public_gig"],
        "lead_id": ID["rohan"],
        "lead_name": "Rohan Sharma",
        "title": "Candid Wedding Photographer Needed — Mumbai",
        "description": (
            "Looking for an experienced candid second shooter for a 2-day wedding in South Mumbai. "
            "Must have own camera body (at least 24 MP). Comfortable with low-light reception shots."
        ),
        "event_type": "Wedding",
        "city": "Mumbai",
        "state": "Maharashtra",
        "roles_needed": ["Second Shooter"],
        "budget_min": 7000,
        "budget_max": 10000,
        "event_date": now_iso(30)[:10],
        "status": "open",
        "expires_at": now_iso(14),
        "applicant_count": 0,
        "created_at": now_iso(-2),
        "updated_at": now_iso(-2),
    }
    if db.public_gigs.find_one({"_id": pub_gig["_id"]}):
        skip(f'Public gig: {pub_gig["title"]}')
    else:
        db.public_gigs.insert_one(pub_gig)
        ok(f'Public gig: {pub_gig["title"]}')


def seed_coupons(db):
    print(f"\n{BOLD}── Coupons ───────────────────────────────────{RESET}")
    coupons = [
        {
            "_id": ID["coupon_welcome"],
            "code": "WELCOME20",
            "discount_type": "percentage",
            "discount_value": 20.0,
            "description": "20% off your first subscription",
            "max_redemptions": 500,
            "redemption_count": 0,
            "is_active": True,
            "expires_at": now_iso(90),
            "created_at": now_iso(-30),
            "updated_at": now_iso(-30),
        },
        {
            "_id": ID["coupon_crew"],
            "code": "CREW50",
            "discount_type": "rupees",
            "discount_value": 50.0,
            "description": "₹50 flat off on any plan",
            "max_redemptions": 200,
            "redemption_count": 3,
            "is_active": True,
            "expires_at": now_iso(60),
            "created_at": now_iso(-20),
            "updated_at": now_iso(-20),
        },
    ]
    for coupon in coupons:
        if db.coupons.find_one({"_id": coupon["_id"]}):
            skip(f'Coupon: {coupon["code"]}')
        else:
            db.coupons.insert_one(coupon)
            ok(f'Coupon: {coupon["code"]} ({coupon["discount_type"]} — {coupon["discount_value"]})')


def seed_chat_messages(db):
    print(f"\n{BOLD}── Gig Chat Messages ─────────────────────────{RESET}")
    messages = [
        {
            "_id": "msg-0000001-0000-0000-0000-000000000001",
            "gig_id": ID["gig_wedding"],
            "sender_id": ID["rohan"],
            "sender_name": "Rohan Sharma",
            "text": "Hey team! Just confirming — we need to be at the hotel lobby by 8:45 AM on the wedding day. Parking is on Level B2.",
            "read_by": [ID["rohan"], ID["priya"], ID["aakash"]],
            "created_at": now_iso(-10),
        },
        {
            "_id": "msg-0000002-0000-0000-0000-000000000002",
            "gig_id": ID["gig_wedding"],
            "sender_id": ID["priya"],
            "sender_name": "Priya Patel",
            "text": "Got it! I'll bring a backup 85mm. Should I bring my reflector too?",
            "read_by": [ID["rohan"], ID["priya"]],
            "created_at": now_iso(-10),
        },
        {
            "_id": "msg-0000003-0000-0000-0000-000000000003",
            "gig_id": ID["gig_wedding"],
            "sender_id": ID["rohan"],
            "sender_name": "Rohan Sharma",
            "text": "Yes please! The terrace shoot at sunset might need it. Aakash, are you bringing the gimbal?",
            "read_by": [ID["rohan"]],
            "created_at": now_iso(-9),
        },
        {
            "_id": "msg-0000004-0000-0000-0000-000000000004",
            "gig_id": ID["gig_wedding"],
            "sender_id": ID["aakash"],
            "sender_name": "Aakash Mehta",
            "text": "Yes! DJI RS3 is fully charged and ready. See you all there 🎥",
            "read_by": [ID["aakash"]],
            "created_at": now_iso(-9),
        },
    ]
    for msg in messages:
        if db.gig_messages.find_one({"_id": msg["_id"]}):
            skip(f'Chat: {msg["sender_name"]}: {msg["text"][:40]}…')
        else:
            db.gig_messages.insert_one(msg)
            ok(f'Chat: {msg["sender_name"]}: {msg["text"][:40]}…')


def seed_notifications(db):
    print(f"\n{BOLD}── Notifications ─────────────────────────────{RESET}")
    notifs = [
        {
            "_id": "notif-00001-0000-0000-0000-000000000001",
            "user_id": ID["rohan"],
            "type": "gig",
            "title": "Gig Completed",
            "message": "Your gig 'Sharma–Mehta Wedding' has been marked as completed.",
            "is_read": True,
            "created_at": now_iso(-8),
        },
        {
            "_id": "notif-00002-0000-0000-0000-000000000002",
            "user_id": ID["priya"],
            "type": "invite",
            "title": "New Gig Invite",
            "message": "Rohan Sharma has invited you to join 'Kapoor Family Portrait Session' as Second Shooter.",
            "is_read": False,
            "created_at": now_iso(-1),
        },
        {
            "_id": "notif-00003-0000-0000-0000-000000000003",
            "user_id": ID["kavya"],
            "type": "invite",
            "title": "New Gig Invite",
            "message": "Rohan Sharma has invited you for a Drone Operator role. Proposed fee: ₹5,000.",
            "is_read": False,
            "created_at": now_iso(-1),
        },
    ]
    for notif in notifs:
        if db.notifications.find_one({"_id": notif["_id"]}):
            skip(f'Notification: {notif["title"]}')
        else:
            db.notifications.insert_one(notif)
            ok(f'Notification → {notif["user_id"][:20]}: {notif["title"]}')


def main():
    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{CYAN}║     CrewBook — Sample Data Seeder        ║{RESET}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════╝{RESET}")
    print(f"\n  {CYAN}MongoDB:{RESET} {MONGO_URL}")
    print(f"  {CYAN}Database:{RESET} {DB_NAME}\n")

    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        client.server_info()  # raises if can't connect
    except Exception as e:
        err(f"Cannot connect to MongoDB: {e}")
        sys.exit(1)

    db = client[DB_NAME]

    seed_users(db)
    seed_plans(db)
    seed_gigs(db)
    seed_invites(db)
    seed_ratings(db)
    seed_connections(db)
    seed_public_gig(db)
    seed_coupons(db)
    seed_chat_messages(db)
    seed_notifications(db)

    client.close()

    print(f"\n{BOLD}{GREEN}╔══════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{GREEN}║  ✓  Seeding complete!                    ║{RESET}")
    print(f"{BOLD}{GREEN}╚══════════════════════════════════════════╝{RESET}")
    print(f"""
  Login credentials:

  {BOLD}Admin{RESET}
    Email:    admin@crewbook.in
    Password: Admin@123
    URL:      /auth → redirects to /admin/dashboard

  {BOLD}Crew Users{RESET}  (all passwords: Test@1234)
    rohan@example.com   — Lead Photographer (Mumbai)
    priya@example.com   — Second Shooter    (Mumbai)
    aakash@example.com  — Videographer      (Delhi)
    kavya@example.com   — Drone Operator    (Bangalore)  [unverified]
    vikram@example.com  — Photo Assistant   (Pune)       [unverified]
""")


if __name__ == "__main__":
    main()
