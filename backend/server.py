from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
import traceback as tb_module
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from routers import auth, users, admin, gigs, connections, wallet, notifications, ratings, ai_routes, public_gigs, platform_settings, templates, calendar_sync, notes, push, plans
from db import client, db

app = FastAPI(title="CrewBook API - Freelance Crew Booking Platform")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    user_id = getattr(request.state, "user_id", None)
    try:
        await db.api_error_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "status_code": exc.status_code,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "error_detail": str(exc.detail),
            "traceback": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as log_err:
        logger.error("api_error_log write failed: %s", log_err)
    return await _default_http_handler(request, exc)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    user_id = getattr(request.state, "user_id", None)
    try:
        await db.api_error_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "status_code": 500,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "error_detail": str(exc),
            "traceback": tb_module.format_exc(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as log_err:
        logger.error("api_error_log write failed: %s", log_err)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


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
api_router.include_router(templates.router, tags=["templates"])
api_router.include_router(calendar_sync.router, tags=["calendar-sync"])
api_router.include_router(notes.router, tags=["notes"])
api_router.include_router(push.router, tags=["push"])
api_router.include_router(plans.router, tags=["plans"])


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
    await db.admin_logs.create_index([("created_at", -1)])
    await db.api_error_logs.create_index([("created_at", -1)])
    await db.payment_logs.create_index([("created_at", -1)])
    await db.ai_usage_logs.create_index([("created_at", -1)])
    await db.whatsapp_logs.create_index([("created_at", -1)])
    await db.login_logs.create_index([("created_at", -1)])
    await db.email_logs.create_index([("created_at", -1)])
    await db.notification_templates.create_index([("event_type", 1)], unique=True, sparse=True)
    await db.calendar_sync_logs.create_index([("user_id", 1), ("created_at", -1)])
    await db.lead_notes.create_index([("lead_id", 1), ("freelancer_id", 1)], unique=True, sparse=True)
    await db.push_subscriptions.create_index([("user_id", 1)])
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.plans.create_index("sort_order")
    await db.plans.create_index("is_active")
    logger.info("CrewBook API started successfully")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
