from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from routers import auth, users, admin, gigs, connections, wallet, notifications, ratings, ai_routes, public_gigs, platform_settings
from db import client, db

app = FastAPI(title="CrewBook API - Freelance Crew Booking Platform")
api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(gigs.router, tags=["gigs"])
api_router.include_router(connections.router, tags=["connections"])
api_router.include_router(wallet.router, tags=["wallet"])
api_router.include_router(notifications.router, tags=["notifications"])
api_router.include_router(ratings.router, tags=["ratings"])
api_router.include_router(ai_routes.router, tags=["ai"])
api_router.include_router(public_gigs.router, tags=["public-gigs"])
api_router.include_router(platform_settings.router, tags=["platform"])


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "CrewBook API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("referral_code")
    await db.gig_invites.create_index([("freelancer_id", 1), ("status", 1)])
    await db.gig_invites.create_index([("gig_id", 1)])
    await db.connections.create_index([("requester_id", 1), ("recipient_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("CrewBook API started successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
