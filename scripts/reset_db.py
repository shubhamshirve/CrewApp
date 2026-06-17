#!/usr/bin/env python3
"""
CrewBook — Database Reset Script
===================================
Drops ALL collections and optionally re-seeds with demo data.

Usage:
    python reset_db.py                   # prompts for confirmation
    python reset_db.py --yes             # skip confirmation, just wipe
    python reset_db.py --yes --seed      # wipe + immediately re-seed demo data
    python reset_db.py --collections users gigs   # wipe specific collections only

Docker:
    docker compose exec backend python /app/scripts/reset_db.py --yes --seed

WARNING: This permanently deletes ALL data. There is no undo.
"""

import os
import sys
import argparse
import subprocess
from dotenv import load_dotenv

# Load .env from backend directory if present
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, "..", "backend", ".env"))

try:
    from pymongo import MongoClient
except ImportError:
    print("ERROR: Missing pymongo. Run: pip install pymongo python-dotenv")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "crewbook_db")

# All known collections (in drop order — safe to add new ones here)
ALL_COLLECTIONS = [
    # User data
    "users",
    "otp_verifications",
    "login_logs",

    # Gigs & bookings
    "gigs",
    "gig_invites",
    "gig_messages",

    # Social
    "connections",
    "lead_notes",
    "ratings",
    "penalty_appeals",

    # Platform
    "notifications",
    "push_subscriptions",
    "plans",
    "coupons",
    "coupon_redemptions",

    # Wallet & payments
    "wallets",
    "wallet_transactions",
    "payment_logs",

    # Public gig board
    "public_gigs",
    "public_gig_applications",

    # Platform config (optional: keep if you don't want to reconfigure)
    "platform_settings",
    "platform_meta",
    "custom_gear_submissions",
    "notification_templates",

    # Logs (safe to clear)
    "admin_logs",
    "api_error_logs",
    "ai_usage_logs",
    "whatsapp_logs",
    "email_logs",
    "calendar_sync_logs",
]

# ── Colours ────────────────────────────────────────────────────────────────────
RED    = "\033[91m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"
DIM    = "\033[2m"


def confirm_reset(collections: list[str]) -> bool:
    """Interactive confirmation prompt."""
    print(f"\n  {RED}{BOLD}⚠  DANGER ZONE — Permanent Data Deletion{RESET}")
    print(f"\n  {BOLD}MongoDB:{RESET} {MONGO_URL}")
    print(f"  {BOLD}Database:{RESET} {DB_NAME}")
    print(f"\n  Collections to be wiped ({len(collections)}):")
    for col in collections:
        print(f"    {DIM}•{RESET} {col}")

    print(f"\n  {RED}This action CANNOT be undone.{RESET}")
    answer = input(f"\n  Type {BOLD}yes{RESET} to confirm, anything else to abort: ").strip().lower()
    return answer == "yes"


def drop_collections(db, collections: list[str]) -> tuple[int, int]:
    """Drop collections. Returns (dropped, skipped) counts."""
    dropped = skipped = 0
    existing = set(db.list_collection_names())

    for col in collections:
        if col in existing:
            db.drop_collection(col)
            print(f"  {RED}✗{RESET}  Dropped: {col}")
            dropped += 1
        else:
            print(f"  {DIM}↷  Skipped (not found): {col}{RESET}")
            skipped += 1

    return dropped, skipped


def run_seed():
    """Run seed_data.py in a subprocess."""
    seed_script = os.path.join(_here, "seed_data.py")
    if not os.path.exists(seed_script):
        print(f"\n  {YELLOW}⚠  seed_data.py not found at {seed_script} — skipping seed{RESET}")
        return

    print(f"\n{'─' * 46}")
    print(f"  {CYAN}→{RESET}  Running seed_data.py …\n")
    env = {**os.environ}  # propagate MONGO_URL / DB_NAME
    result = subprocess.run([sys.executable, seed_script], env=env)
    if result.returncode != 0:
        print(f"\n  {YELLOW}⚠  seed_data.py exited with code {result.returncode}{RESET}")


def main():
    parser = argparse.ArgumentParser(
        description="Reset (wipe) the CrewBook MongoDB database.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip the confirmation prompt and proceed immediately",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Re-seed demo data after wiping (runs seed_data.py)",
    )
    parser.add_argument(
        "--collections",
        nargs="+",
        metavar="COLLECTION",
        help="Only drop these specific collections (default: all)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all collections that would be dropped, then exit",
    )
    args = parser.parse_args()

    target_collections = args.collections if args.collections else ALL_COLLECTIONS

    if args.list:
        print(f"\n  {BOLD}Collections targeted for reset:{RESET}")
        for col in target_collections:
            print(f"    • {col}")
        print()
        sys.exit(0)

    print(f"\n{BOLD}{CYAN}╔══════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{CYAN}║     CrewBook — Database Reset            ║{RESET}")
    print(f"{BOLD}{CYAN}╚══════════════════════════════════════════╝{RESET}")

    # Connect
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        client.server_info()
    except Exception as e:
        print(f"\n  {RED}✗  Cannot connect to MongoDB: {e}{RESET}")
        sys.exit(1)

    db = client[DB_NAME]

    # Confirm unless --yes
    if not args.yes:
        if not confirm_reset(target_collections):
            print(f"\n  {YELLOW}Aborted.{RESET}\n")
            client.close()
            sys.exit(0)

    # Drop
    print(f"\n{BOLD}── Dropping collections ──────────────────────{RESET}")
    dropped, skipped = drop_collections(db, target_collections)

    client.close()

    print(f"\n{BOLD}{GREEN}╔══════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{GREEN}║  ✓  Reset complete                       ║{RESET}")
    print(f"{BOLD}{GREEN}╚══════════════════════════════════════════╝{RESET}")
    print(f"\n  Collections dropped: {RED}{dropped}{RESET}   Skipped (not found): {DIM}{skipped}{RESET}\n")

    if args.seed:
        run_seed()
    else:
        print(f"  {DIM}Tip: run with --seed to also populate demo data{RESET}\n")


if __name__ == "__main__":
    main()
