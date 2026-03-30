"""
Seed Router — Populate the database with realistic demo data for CrewBook.
POST /api/seed          → seeds data (idempotent, skips if already seeded)
POST /api/seed?force=1  → drops existing seed data and re-seeds
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone, timedelta
import uuid
import random
import string
import logging

from db import get_db
from auth_utils import hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/seed")

_SEED_MARKER = "crewbook_seed_v1"

# ── Helper ────────────────────────────────────────────────────────────────────

def _id() -> str:
    return str(uuid.uuid4())

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()

def _dt(days_offset: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()

def _date(days_offset: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days_offset)).strftime("%Y-%m-%d")

def _ref(name: str) -> str:
    prefix = "".join(c for c in name[:3].upper() if c.isalpha()) or "CRW"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}{suffix}"


# ── Static seed data ──────────────────────────────────────────────────────────

_ADMIN_USER = {
    "full_name": "Shubham Admin",
    "email": "shubham@crewbook.in",
    "password": "Shubham@123",
    "phone": "9999999999",
    "location": "Mumbai",
    "area": "Andheri",
    "state": "Maharashtra",
    "pincode": "400053",
}

_LEAD_USERS = [
    {
        "full_name": "Arjun Kapoor",
        "email": "arjun.kapoor@crewbook.in",
        "phone": "9876543210",
        "location": "Mumbai",
        "area": "Bandra West",
        "state": "Maharashtra",
        "pincode": "400050",
        "bio": "Lead wedding photographer with 8 years of experience covering luxury weddings across India. Specialised in candid storytelling.",
        "primary_role": "Lead Photographer",
        "secondary_role": "Photo Editor",
        "primary_rate": 25000,
        "secondary_rate": 8000,
        "style_tags": ["Candid", "Fine Art", "Cinematic"],
        "editing_ecosystem": ["Lightroom", "Photoshop"],
        "upi_id": "arjun.kapoor@upi",
        "years_of_experience": 8,
        "wallet_balance": 5000,
        "subscription_plan": "premium",
    },
    {
        "full_name": "Priya Sharma",
        "email": "priya.sharma@crewbook.in",
        "phone": "9876543211",
        "location": "Delhi",
        "area": "South Delhi",
        "state": "Delhi",
        "pincode": "110065",
        "bio": "Delhi-based lead photographer specialising in traditional and contemporary wedding photography. Covered 300+ weddings.",
        "primary_role": "Lead Photographer",
        "secondary_role": "Traditional Videographer",
        "primary_rate": 20000,
        "secondary_rate": 15000,
        "style_tags": ["Traditional", "Documentary", "Bright & Airy"],
        "editing_ecosystem": ["Lightroom", "Capture One"],
        "upi_id": "priya.sharma@upi",
        "years_of_experience": 6,
        "wallet_balance": 3500,
        "subscription_plan": "base",
    },
    {
        "full_name": "Rahul Mehta",
        "email": "rahul.mehta@crewbook.in",
        "phone": "9876543212",
        "location": "Bengaluru",
        "area": "Indiranagar",
        "state": "Karnataka",
        "pincode": "560038",
        "bio": "Cinematic wedding filmmaker and photographer based in Bangalore. Known for LGBTQ-inclusive and destination weddings.",
        "primary_role": "Cinematic Videographer",
        "secondary_role": "Lead Photographer",
        "primary_rate": 30000,
        "secondary_rate": 22000,
        "style_tags": ["Cinematic", "Dark & Moody", "Documentary"],
        "editing_ecosystem": ["DaVinci Resolve", "Premiere Pro", "Lightroom"],
        "upi_id": "rahul.mehta@upi",
        "years_of_experience": 10,
        "wallet_balance": 8000,
        "subscription_plan": "premium",
    },
]

_FREELANCER_USERS = [
    {
        "full_name": "Kavya Nair",
        "email": "kavya.nair@crewbook.in",
        "phone": "9876543220",
        "location": "Mumbai",
        "area": "Andheri East",
        "state": "Maharashtra",
        "pincode": "400069",
        "bio": "Second shooter with a keen eye for candid moments. Comfortable in low-light indoor venues.",
        "primary_role": "Second Shooter",
        "secondary_role": "Photo Editor",
        "primary_rate": 8000,
        "secondary_rate": 3000,
        "style_tags": ["Candid", "Documentary"],
        "editing_ecosystem": ["Lightroom", "Photoshop"],
        "upi_id": "kavya.nair@upi",
        "years_of_experience": 3,
        "wallet_balance": 2000,
        "subscription_plan": "base",
        "gear_vault": [
            {"category": "Camera", "name": "Sony A7III", "is_custom": False},
            {"category": "Lens", "name": "Sony 85mm f/1.8", "is_custom": False},
        ],
    },
    {
        "full_name": "Vikram Singh",
        "email": "vikram.singh@crewbook.in",
        "phone": "9876543221",
        "location": "Delhi",
        "area": "Karol Bagh",
        "state": "Delhi",
        "pincode": "110005",
        "bio": "Traditional videographer with 5 years shooting North Indian weddings. Expert in ceremony coverage.",
        "primary_role": "Traditional Videographer",
        "secondary_role": "Drone Operator",
        "primary_rate": 12000,
        "secondary_rate": 10000,
        "style_tags": ["Traditional", "Documentary"],
        "editing_ecosystem": ["Premiere Pro"],
        "upi_id": "vikram.singh@upi",
        "years_of_experience": 5,
        "wallet_balance": 1500,
        "subscription_plan": "base",
        "gear_vault": [
            {"category": "Camera", "name": "Canon EOS R6", "is_custom": False},
            {"category": "Drone", "name": "DJI Mini 3 Pro", "is_custom": False},
        ],
    },
    {
        "full_name": "Sneha Patel",
        "email": "sneha.patel@crewbook.in",
        "phone": "9876543222",
        "location": "Ahmedabad",
        "area": "Navrangpura",
        "state": "Gujarat",
        "pincode": "380009",
        "bio": "Photo assistant and lighting specialist. Skilled in managing large lighting setups for mandap photography.",
        "primary_role": "Photo Assistant",
        "secondary_role": "Lighting Technician",
        "primary_rate": 5000,
        "secondary_rate": 6000,
        "style_tags": ["Traditional", "Fine Art"],
        "editing_ecosystem": ["Lightroom"],
        "upi_id": "sneha.patel@upi",
        "years_of_experience": 2,
        "wallet_balance": 800,
        "subscription_plan": "none",
        "gear_vault": [
            {"category": "Lighting", "name": "Godox AD200 Pro", "is_custom": False},
        ],
    },
    {
        "full_name": "Aditya Rao",
        "email": "aditya.rao@crewbook.in",
        "phone": "9876543223",
        "location": "Hyderabad",
        "area": "Jubilee Hills",
        "state": "Telangana",
        "pincode": "500033",
        "bio": "Drone operator and cinematic videographer. FAA certified. Covered 50+ aerial sequences for luxury weddings.",
        "primary_role": "Drone Operator",
        "secondary_role": "Cinematic Videographer",
        "primary_rate": 15000,
        "secondary_rate": 20000,
        "style_tags": ["Cinematic", "Dark & Moody"],
        "editing_ecosystem": ["DaVinci Resolve", "Final Cut Pro"],
        "upi_id": "aditya.rao@upi",
        "years_of_experience": 4,
        "wallet_balance": 3000,
        "subscription_plan": "premium",
        "gear_vault": [
            {"category": "Drone", "name": "DJI Mavic 3 Pro", "is_custom": False},
            {"category": "Camera", "name": "Sony FX3", "is_custom": False},
        ],
    },
    {
        "full_name": "Meera Iyer",
        "email": "meera.iyer@crewbook.in",
        "phone": "9876543224",
        "location": "Chennai",
        "area": "T. Nagar",
        "state": "Tamil Nadu",
        "pincode": "600017",
        "bio": "South Indian wedding specialist. Expert in Brahmin, Mudaliar, and Chettiar wedding traditions. 7 years experience.",
        "primary_role": "Second Shooter",
        "secondary_role": "Photo Editor",
        "primary_rate": 9000,
        "secondary_rate": 4000,
        "style_tags": ["Traditional", "Documentary", "Candid"],
        "editing_ecosystem": ["Lightroom", "Photoshop"],
        "upi_id": "meera.iyer@upi",
        "years_of_experience": 7,
        "wallet_balance": 1200,
        "subscription_plan": "base",
        "gear_vault": [
            {"category": "Camera", "name": "Nikon Z6 II", "is_custom": False},
            {"category": "Lens", "name": "Nikon 50mm f/1.8", "is_custom": False},
        ],
    },
]

_GIGS_DATA = [
    {
        "title": "Sharma-Verma Wedding — Jaipur (3-Day Event)",
        "description": "Luxury Rajasthani wedding at Samode Haveli. Need full crew for 3-day coverage including Mehndi, Sangeet, and Wedding Day.",
        "sessions": [
            {
                "date": _date(10),
                "start_time": "14:00",
                "end_time": "21:00",
                "location": "Samode Haveli, Jaipur",
                "venue_name": "Samode Haveli",
                "event_type": "Mehendi",
            },
            {
                "date": _date(11),
                "start_time": "18:00",
                "end_time": "23:00",
                "location": "Samode Haveli, Jaipur",
                "venue_name": "Samode Haveli",
                "event_type": "Sangeet",
            },
            {
                "date": _date(12),
                "start_time": "07:00",
                "end_time": "22:00",
                "location": "Samode Haveli, Jaipur",
                "venue_name": "Samode Haveli",
                "event_type": "Wedding",
            },
        ],
    },
    {
        "title": "Iyer-Krishnan Wedding — Chennai (2-Day)",
        "description": "Traditional Tam Brahm wedding. Looking for experienced shooters familiar with South Indian ceremonies.",
        "sessions": [
            {
                "date": _date(20),
                "start_time": "06:00",
                "end_time": "14:00",
                "location": "Narada Gana Sabha, Chennai",
                "venue_name": "Narada Gana Sabha",
                "event_type": "Wedding",
            },
            {
                "date": _date(21),
                "start_time": "10:00",
                "end_time": "18:00",
                "location": "Narada Gana Sabha, Chennai",
                "venue_name": "Narada Gana Sabha",
                "event_type": "Reception",
            },
        ],
    },
    {
        "title": "Gupta-Singh Pre-Wedding Shoot — Udaipur",
        "description": "Pre-wedding shoot at Lake Pichola. 1-day session, drone + photography combo.",
        "sessions": [
            {
                "date": _date(5),
                "start_time": "06:30",
                "end_time": "12:00",
                "location": "Lake Pichola, Udaipur",
                "venue_name": "Lake Pichola Boat",
                "event_type": "Pre-Wedding Shoot",
            },
            {
                "date": _date(5),
                "start_time": "16:00",
                "end_time": "19:30",
                "location": "City Palace, Udaipur",
                "venue_name": "City Palace",
                "event_type": "Pre-Wedding Shoot",
            },
        ],
    },
]

_PLANS_DATA = [
    {
        "name": "Base Plan",
        "price": 69.0,
        "description": "Access core booking features, gig management, and connections.",
        "features": {"public_gig_enabled": False, "whatsapp_enabled": False},
        "validity": "monthly",
        "legacy_tier": "base",
        "is_active": True,
        "sort_order": 0,
    },
    {
        "name": "Premium Plan",
        "price": 99.0,
        "description": "Everything in Base + Public Gig Board + WhatsApp notifications.",
        "features": {"public_gig_enabled": True, "whatsapp_enabled": True},
        "validity": "monthly",
        "legacy_tier": "premium",
        "is_active": True,
        "sort_order": 1,
    },
]


# ── Seed endpoint ─────────────────────────────────────────────────────────────

@router.post("")
async def seed_database(force: bool = Query(False, description="Drop existing seed data and re-seed")):
    """
    Populate the database with realistic demo data.
    Idempotent by default — skips if seed marker already exists.
    Use ?force=true to wipe and re-seed.
    """
    db = get_db()

    # Check for existing seed
    marker = await db.seed_markers.find_one({"_id": _SEED_MARKER})
    if marker and not force:
        return {
            "status": "skipped",
            "message": "Database already seeded. Use ?force=true to re-seed.",
            "seeded_at": marker.get("created_at"),
        }

    if force:
        logger.info("Force re-seed: deleting previous seed data...")
        # Only delete documents tagged with seed marker
        await db.users.delete_many({"_seed": True})
        await db.gigs.delete_many({"_seed": True})
        await db.gig_invites.delete_many({"_seed": True})
        await db.connections.delete_many({"_seed": True})
        await db.ratings.delete_many({"_seed": True})
        await db.wallet_transactions.delete_many({"_seed": True})
        await db.plans.delete_many({"_seed": True})
        await db.seed_markers.delete_one({"_id": _SEED_MARKER})

    summary = {
        "admin": 0,
        "plans": 0,
        "leads": 0,
        "freelancers": 0,
        "gigs": 0,
        "invites": 0,
        "connections": 0,
        "ratings": 0,
    }

    # ── 0. Admin User ─────────────────────────────────────────────────────────
    existing_admin = await db.users.find_one({"email": _ADMIN_USER["email"]})
    if existing_admin:
        # Update password in case it changed
        await db.users.update_one(
            {"_id": existing_admin["_id"]},
            {"$set": {"password_hash": hash_password(_ADMIN_USER["password"]), "is_admin": True}},
        )
    else:
        admin_id = _id()
        await db.users.insert_one({
            "_id": admin_id,
            "_seed": True,
            "email": _ADMIN_USER["email"],
            "password_hash": hash_password(_ADMIN_USER["password"]),
            "full_name": _ADMIN_USER["full_name"],
            "phone": _ADMIN_USER["phone"],
            "location": _ADMIN_USER["location"],
            "area": _ADMIN_USER.get("area", ""),
            "state": _ADMIN_USER.get("state", ""),
            "country": "India",
            "pincode": _ADMIN_USER["pincode"],
            "bio": "Platform administrator",
            "is_admin": True,
            "is_verified": True,
            "verification_status": "approved",
            "is_suspended": False,
            "is_ghost_mode": False,
            "wallet_balance": 0,
            "subscription_plan": "none",
            "active_plan_id": None,
            "active_plan_features": {},
            "whatsapp_enabled": False,
            "referral_code": _ref("Shubham"),
            "referred_by": None,
            "penalty_score": 0,
            "average_rating": 0,
            "rating_count": 0,
            "style_tags": [],
            "editing_ecosystem": [],
            "gear_vault": [],
            "primary_role": None,
            "secondary_role": None,
            "primary_rate": None,
            "secondary_rate": None,
            "created_at": _now(),
        })
        summary["admin"] += 1

    # ── 1. Plans ──────────────────────────────────────────────────────────────
    plan_ids = {}
    for plan_data in _PLANS_DATA:
        plan_id = _id()
        existing = await db.plans.find_one({"name": plan_data["name"]})
        if existing:
            plan_ids[plan_data["legacy_tier"]] = existing["_id"]
        else:
            doc = {
                "_id": plan_id,
                "_seed": True,
                "name": plan_data["name"],
                "price": plan_data["price"],
                "description": plan_data["description"],
                "features": plan_data["features"],
                "validity": plan_data["validity"],
                "legacy_tier": plan_data["legacy_tier"],
                "is_active": plan_data["is_active"],
                "sort_order": plan_data["sort_order"],
                "subscriber_count": 0,
                "created_at": _now(),
            }
            await db.plans.insert_one(doc)
            plan_ids[plan_data["legacy_tier"]] = plan_id
            summary["plans"] += 1

    # ── 2. Lead Photographers ─────────────────────────────────────────────────
    lead_ids = []
    for u in _LEAD_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            lead_ids.append(existing["_id"])
            continue

        tier = u.get("subscription_plan", "none")
        plan_id = plan_ids.get(tier)
        features = next(
            (p["features"] for p in _PLANS_DATA if p["legacy_tier"] == tier),
            {"public_gig_enabled": False, "whatsapp_enabled": False},
        )

        user_id = _id()
        doc = {
            "_id": user_id,
            "_seed": True,
            "email": u["email"],
            "password_hash": hash_password("Crewbook@123"),
            "full_name": u["full_name"],
            "phone": u["phone"],
            "location": u["location"],
            "area": u.get("area", ""),
            "state": u.get("state", ""),
            "country": "India",
            "pincode": u["pincode"],
            "bio": u.get("bio", ""),
            "primary_role": u.get("primary_role"),
            "secondary_role": u.get("secondary_role"),
            "primary_rate": u.get("primary_rate"),
            "secondary_rate": u.get("secondary_rate"),
            "style_tags": u.get("style_tags", []),
            "editing_ecosystem": u.get("editing_ecosystem", []),
            "gear_vault": u.get("gear_vault", []),
            "upi_id": u.get("upi_id"),
            "years_of_experience": u.get("years_of_experience"),
            "profile_image": None,
            "instagram_url": None,
            "website_url": None,
            "is_admin": False,
            "is_verified": True,
            "verification_status": "approved",
            "is_suspended": False,
            "is_ghost_mode": False,
            "wallet_balance": u.get("wallet_balance", 0),
            "subscription_plan": tier,
            "active_plan_id": plan_id,
            "active_plan_features": features,
            "whatsapp_enabled": features.get("whatsapp_enabled", False),
            "referral_code": _ref(u["full_name"]),
            "referred_by": None,
            "penalty_score": 0,
            "average_rating": round(random.uniform(4.2, 5.0), 1),
            "rating_count": random.randint(5, 30),
            "created_at": _dt(-random.randint(30, 180)),
        }
        await db.users.insert_one(doc)
        lead_ids.append(user_id)
        summary["leads"] += 1

    # ── 3. Freelancers ────────────────────────────────────────────────────────
    freelancer_ids = []
    for u in _FREELANCER_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            freelancer_ids.append(existing["_id"])
            continue

        tier = u.get("subscription_plan", "none")
        plan_id = plan_ids.get(tier)
        features = next(
            (p["features"] for p in _PLANS_DATA if p["legacy_tier"] == tier),
            {"public_gig_enabled": False, "whatsapp_enabled": False},
        )

        user_id = _id()
        doc = {
            "_id": user_id,
            "_seed": True,
            "email": u["email"],
            "password_hash": hash_password("Crewbook@123"),
            "full_name": u["full_name"],
            "phone": u["phone"],
            "location": u["location"],
            "area": u.get("area", ""),
            "state": u.get("state", ""),
            "country": "India",
            "pincode": u["pincode"],
            "bio": u.get("bio", ""),
            "primary_role": u.get("primary_role"),
            "secondary_role": u.get("secondary_role"),
            "primary_rate": u.get("primary_rate"),
            "secondary_rate": u.get("secondary_rate"),
            "style_tags": u.get("style_tags", []),
            "editing_ecosystem": u.get("editing_ecosystem", []),
            "gear_vault": u.get("gear_vault", []),
            "upi_id": u.get("upi_id"),
            "years_of_experience": u.get("years_of_experience"),
            "profile_image": None,
            "instagram_url": None,
            "website_url": None,
            "is_admin": False,
            "is_verified": True,
            "verification_status": "approved",
            "is_suspended": False,
            "is_ghost_mode": False,
            "wallet_balance": u.get("wallet_balance", 0),
            "subscription_plan": tier,
            "active_plan_id": plan_id,
            "active_plan_features": features,
            "whatsapp_enabled": features.get("whatsapp_enabled", False),
            "referral_code": _ref(u["full_name"]),
            "referred_by": None,
            "penalty_score": 0,
            "average_rating": round(random.uniform(3.8, 5.0), 1),
            "rating_count": random.randint(2, 20),
            "created_at": _dt(-random.randint(10, 120)),
        }
        await db.users.insert_one(doc)
        freelancer_ids.append(user_id)
        summary["freelancers"] += 1

    # ── 4. Gigs ───────────────────────────────────────────────────────────────
    gig_ids = []
    for i, gig_data in enumerate(_GIGS_DATA):
        lead_id = lead_ids[i % len(lead_ids)]
        gig_id = _id()

        doc = {
            "_id": gig_id,
            "_seed": True,
            "lead_photographer_id": lead_id,
            "title": gig_data["title"],
            "description": gig_data["description"],
            "sessions": gig_data["sessions"],
            "status": "active",
            "data_delivered": False,
            "workspace_items": [],
            "created_at": _dt(-random.randint(1, 7)),
        }
        await db.gigs.insert_one(doc)
        gig_ids.append(gig_id)
        summary["gigs"] += 1

    # ── 5. Gig Invites ────────────────────────────────────────────────────────
    invite_configs = [
        # (gig_index, freelancer_index, role, fee, status, counter_fee)
        (0, 0, "Second Shooter", 8000, "accepted", None),
        (0, 1, "Traditional Videographer", 12000, "accepted", None),
        (0, 2, "Photo Assistant", 5000, "pending", None),
        (0, 3, "Drone Operator", 15000, "counter_offered", 18000),
        (1, 4, "Second Shooter", 9000, "accepted", None),
        (1, 1, "Traditional Videographer", 11000, "pending", None),
        (2, 3, "Drone Operator", 14000, "accepted", None),
        (2, 0, "Second Shooter", 7500, "rejected", None),
    ]

    for gig_idx, fl_idx, role, fee, status, counter_fee in invite_configs:
        if gig_idx >= len(gig_ids) or fl_idx >= len(freelancer_ids):
            continue

        gig_id = gig_ids[gig_idx]
        gig_data = _GIGS_DATA[gig_idx]
        lead_id = lead_ids[gig_idx % len(lead_ids)]
        freelancer_id = freelancer_ids[fl_idx]
        session_date = gig_data["sessions"][0]["date"]

        invite_id = _id()
        created = _dt(-random.randint(1, 3))
        doc = {
            "_id": invite_id,
            "_seed": True,
            "gig_id": gig_id,
            "lead_id": lead_id,
            "freelancer_id": freelancer_id,
            "role": role,
            "proposed_fee": fee,
            "agreed_fee": fee if status == "accepted" else None,
            "counter_fee": counter_fee,
            "status": status,
            "session_date": session_date,
            "message": f"Hi! We'd love to have you as {role} for this event.",
            "advance_paid": fee * 0.5 if status == "accepted" else None,
            "balance_paid": None,
            "payment_notes": None,
            "created_at": created,
            "expires_at": _dt(1),
            "invite_viewed_at": created if status != "pending" else None,
            "snoozed_until": None,
        }
        await db.gig_invites.insert_one(doc)
        summary["invites"] += 1

    # ── 6. Connections ────────────────────────────────────────────────────────
    connection_pairs = [
        (0, 0), (0, 1), (0, 2),   # lead[0] → freelancers[0,1,2]
        (1, 3), (1, 4),            # lead[1] → freelancers[3,4]
        (2, 0), (2, 3),            # lead[2] → freelancers[0,3]
    ]
    for lead_idx, fl_idx in connection_pairs:
        if lead_idx >= len(lead_ids) or fl_idx >= len(freelancer_ids):
            continue
        conn_id = _id()
        doc = {
            "_id": conn_id,
            "_seed": True,
            "requester_id": lead_ids[lead_idx],
            "recipient_id": freelancer_ids[fl_idx],
            "status": "accepted",
            "created_at": _dt(-random.randint(5, 30)),
            "accepted_at": _dt(-random.randint(1, 5)),
        }
        await db.connections.insert_one(doc)
        summary["connections"] += 1

    # ── 7. Ratings ────────────────────────────────────────────────────────────
    rating_configs = [
        (0, 0, 5, 4, 5),   # lead[0] rates freelancer[0]
        (0, 1, 4, 5, 4),
        (1, 4, 5, 5, 5),
        (2, 3, 4, 4, 5),
    ]
    for lead_idx, fl_idx, p, g, t in rating_configs:
        if lead_idx >= len(lead_ids) or fl_idx >= len(freelancer_ids):
            continue
        rating_id = _id()
        avg = round((p + g + t) / 3, 1)
        doc = {
            "_id": rating_id,
            "_seed": True,
            "rater_id": lead_ids[lead_idx],
            "rated_id": freelancer_ids[fl_idx],
            "gig_id": gig_ids[lead_idx % len(gig_ids)],
            "punctuality": p,
            "gear_handling": g,
            "teamwork": t,
            "average": avg,
            "is_anonymous": True,
            "created_at": _dt(-random.randint(1, 10)),
        }
        await db.ratings.insert_one(doc)
        summary["ratings"] += 1

    # ── 8. Mark seeded ───────────────────────────────────────────────────────
    await db.seed_markers.insert_one({
        "_id": _SEED_MARKER,
        "created_at": _now(),
        "summary": summary,
    })

    logger.info("Seed completed: %s", summary)

    return {
        "status": "ok",
        "message": "Database seeded successfully",
        "summary": summary,
        "test_credentials": {
            "password": "Crewbook@123",
            "admin": _ADMIN_USER["email"],
            "admin_password": _ADMIN_USER["password"],
            "leads": [u["email"] for u in _LEAD_USERS],
            "freelancers": [u["email"] for u in _FREELANCER_USERS],
        },
    }


@router.get("/status")
async def seed_status():
    """Check whether the database has been seeded."""
    db = get_db()
    marker = await db.seed_markers.find_one({"_id": _SEED_MARKER})
    if not marker:
        return {"seeded": False}
    marker.pop("_id", None)
    return {"seeded": True, **marker}
