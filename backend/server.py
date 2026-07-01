from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
import os
import logging
import uuid
import traceback as tb_module
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from rate_limit import limiter
from routers import (
    auth, users, admin, gigs, connections, wallet, notifications,
    ratings, ai_routes, public_gigs, platform_settings, templates,
    calendar_sync, notes, push, plans, reports, chat, coupons, uploads,
)
from db import client, db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── Security headers middleware ────────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await db.users.create_index("email", unique=True)
    await db.users.create_index("referral_code")
    await db.users.create_index("username", unique=True, sparse=True)  # sparse allows null values
    await db.users.create_index([("primary_role", 1), ("is_ghost_mode", 1), ("is_suspended", 1)])
    await db.users.create_index([("location", 1), ("is_ghost_mode", 1)])
    await db.gigs.create_index([("lead_photographer_id", 1), ("created_at", -1)])
    await db.gigs.create_index([("status", 1)])
    await db.gig_invites.create_index([("freelancer_id", 1), ("status", 1)])
    await db.gig_invites.create_index([("gig_id", 1)])
    await db.gig_invites.create_index([("lead_id", 1)])
    await db.gig_invites.create_index([("freelancer_id", 1), ("status", 1), ("session_date", 1)])
    await db.connections.create_index([("requester_id", 1), ("recipient_id", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.wallet_transactions.create_index([("user_id", 1), ("created_at", -1)])
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
    await db.public_gigs.create_index([("status", 1), ("created_at", -1)])
    await db.public_gigs.create_index([("status", 1), ("expires_at", 1)])
    await db.public_gigs.create_index([("lead_id", 1), ("created_at", -1)])
    await db.public_gig_applications.create_index([("public_gig_id", 1), ("applicant_id", 1)])
    await db.public_gig_applications.create_index([("applicant_id", 1), ("created_at", -1)])
    await db.custom_gear_submissions.create_index([("status", 1), ("created_at", -1)])
    await db.otp_verifications.create_index("expires_at", expireAfterSeconds=0)  # TTL auto-delete
    await db.gig_messages.create_index([("gig_id", 1), ("created_at", 1)])
    await db.coupons.create_index([("is_active", 1)])
    await db.coupon_redemptions.create_index([("coupon_code", 1), ("user_id", 1)])

    cors_origins = os.environ.get("CORS_ORIGINS", "*")
    if cors_origins == "*":
        logger.warning("CORS_ORIGINS is set to wildcard (*) — restrict this in production")

    logger.info("Photoo API started successfully")
    yield
    # ── Shutdown ──
    client.close()


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Photoo API",
    description="Freelance Crew Booking Platform",
    lifespan=lifespan,
    # Hide docs in production
    docs_url="/api/docs" if os.environ.get("ENV", "development") != "production" else None,
    redoc_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers
app.add_middleware(SecurityHeadersMiddleware)

# CORS
cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# ── Error handlers ────────────────────────────────────────────────────────────

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


# ── Routers ───────────────────────────────────────────────────────────────────

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
api_router.include_router(reports.router, tags=["reports"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(coupons.router, tags=["coupons"])
api_router.include_router(uploads.router, tags=["uploads"])


@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "Photoo API"}


app.include_router(api_router)
