"""
Email Notification Service (Resend)
Sends transactional emails. Gracefully falls back to DB logging when API key is not set.
Keys are read from DB (Admin Settings → platform_secrets) first, then env var fallback.
"""
import os
import asyncio
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def _get_resend_credentials(db) -> tuple[str | None, str]:
    """
    Fetch Resend API key and sender email with priority:
      1. DB — platform_secrets.resend.api_key / sender_email
      2. Env vars — RESEND_API_KEY / SENDER_EMAIL
    """
    try:
        doc = await db.platform_secrets.find_one({"_id": "api_keys"})
        if doc and doc.get("resend"):
            resend_cfg = doc["resend"]
            db_key = resend_cfg.get("api_key", "").strip()
            db_sender = resend_cfg.get("sender_email", "").strip()
            if db_key:
                return db_key, db_sender or os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    except Exception as exc:
        logger.error("[EmailService] DB read error: %s", exc)
    # Fallback to env vars
    env_key = os.environ.get("RESEND_API_KEY", "").strip() or None
    env_sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    return env_key, env_sender


async def _log_email(db, recipient: str, subject: str, event_type: str, status: str, error: str = None, has_key: bool = False):
    await db.email_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "recipient": recipient,
        "subject": subject,
        "event_type": event_type,
        "status": status,
        "error": error,
        "simulated": not has_key,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def send_email(
    db,
    recipient_email: str,
    subject: str,
    html_content: str,
    event_type: str = "notification",
) -> dict:
    """Send email via Resend, or log it if no API key is configured."""
    api_key, sender_email = await _get_resend_credentials(db)

    if not api_key:
        logger.info(f"[Email MOCK] To: {recipient_email} | Subject: {subject} | Event: {event_type}")
        await _log_email(db, recipient_email, subject, event_type, "simulated", has_key=False)
        return {"status": "simulated", "message": "No Resend API key configured. Set it in Admin Settings → API Keys."}

    try:
        import resend
        resend.api_key = api_key
        params = {
            "from": sender_email,
            "to": [recipient_email],
            "subject": subject,
            "html": html_content,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        await _log_email(db, recipient_email, subject, event_type, "sent", has_key=True)
        logger.info(f"[Email] Sent to {recipient_email} | ID: {email_id}")
        return {"status": "sent", "email_id": email_id}
    except Exception as e:
        logger.error(f"[Email] Failed to send to {recipient_email}: {e}")
        await _log_email(db, recipient_email, subject, event_type, "failed", str(e), has_key=True)
        return {"status": "failed", "error": str(e)}


# ── Template-based helpers ────────────────────────────────────────────────────

async def get_template(db, event_type: str) -> dict | None:
    """Fetch notification template from DB for the given event type."""
    tmpl = await db.notification_templates.find_one({"event_type": event_type, "is_active": True}, {"_id": 0})
    return tmpl


def _render_template(template_str: str, variables: dict) -> str:
    """Simple {{variable}} substitution."""
    result = template_str
    for k, v in variables.items():
        result = result.replace("{{" + k + "}}", str(v))
    return result


async def send_otp_email(db, recipient_email: str, otp: str, full_name: str = ""):
    """Send a 6-digit OTP verification email."""
    display_name = full_name or "there"
    subject = "Photoo — Your verification code"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #0A0A0A; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="color: #F97316; margin: 0; font-size: 22px;">Photoo</h2>
        <p style="color: #9CA3AF; margin: 4px 0 0; font-size: 13px;">Freelance Crew Booking Platform</p>
      </div>
      <div style="padding: 32px 24px; background: #ffffff; text-align: center;">
        <p style="color: #374151; margin: 0 0 8px;">Hi <strong>{display_name}</strong>,</p>
        <p style="color: #6B7280; font-size: 14px; margin: 0 0 24px;">
          Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background: #F9FAFB; border: 2px dashed #E5E7EB; border-radius: 12px; padding: 20px; margin: 0 auto 24px; display: inline-block; min-width: 220px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #111827; font-family: monospace;">{otp}</span>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          If you didn't request this, ignore this email.
        </p>
      </div>
      <div style="padding: 16px; text-align: center; color: #9CA3AF; font-size: 11px; background: #F9FAFB; border-radius: 0 0 8px 8px;">
        Photoo · Freelance Crew Platform · India
      </div>
    </div>"""
    return await send_email(db, recipient_email, subject, html, "otp_verification")


async def send_invite_email(db, freelancer_email: str, freelancer_name: str, lead_name: str, gig_title: str, fee: float, invite_id: str):
    tmpl = await get_template(db, "invite_sent")
    variables = {
        "freelancer_name": freelancer_name,
        "lead_name": lead_name,
        "gig_title": gig_title,
        "fee": f"₹{fee:,.0f}",
        "invite_id": invite_id,
    }
    if tmpl and tmpl.get("email_subject") and tmpl.get("email_body"):
        subject = _render_template(tmpl["email_subject"], variables)
        html = _render_template(tmpl["email_body"], variables)
    else:
        subject = f"New Gig Invite: {gig_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A0A0A; padding: 24px; text-align: center;">
            <h2 style="color: #F59E0B; margin: 0;">Photoo</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{freelancer_name}</strong>,</p>
            <p><strong>{lead_name}</strong> has invited you to work on <strong>"{gig_title}"</strong>.</p>
            <p>Proposed fee: <strong>₹{fee:,.0f}</strong></p>
            <p>Log in to Photoo to accept, reject, or counter this invite.</p>
            <a href="#" style="display:inline-block;background:#F59E0B;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">View Invite</a>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            Photoo · Freelance Crew Platform · India
          </div>
        </div>"""
    await send_email(db, freelancer_email, subject, html, "invite_sent")


async def send_booking_confirmed_email(db, freelancer_email: str, freelancer_name: str, gig_title: str, agreed_fee: float):
    tmpl = await get_template(db, "booking_confirmed")
    variables = {
        "freelancer_name": freelancer_name,
        "gig_title": gig_title,
        "agreed_fee": f"₹{agreed_fee:,.0f}",
    }
    if tmpl and tmpl.get("email_subject") and tmpl.get("email_body"):
        subject = _render_template(tmpl["email_subject"], variables)
        html = _render_template(tmpl["email_body"], variables)
    else:
        subject = f"Booking Confirmed: {gig_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A0A0A; padding: 24px; text-align: center;">
            <h2 style="color: #F59E0B; margin: 0;">Photoo</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{freelancer_name}</strong>,</p>
            <p>Your booking for <strong>"{gig_title}"</strong> is confirmed!</p>
            <p>Agreed fee: <strong>₹{agreed_fee:,.0f}</strong></p>
            <p>Check the gig workspace on Photoo for details and updates.</p>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            Photoo · Freelance Crew Platform · India
          </div>
        </div>"""
    await send_email(db, freelancer_email, subject, html, "booking_confirmed")


async def send_gig_completed_email(db, lead_email: str, lead_name: str, gig_title: str):
    tmpl = await get_template(db, "gig_completed")
    variables = {"lead_name": lead_name, "gig_title": gig_title}
    if tmpl and tmpl.get("email_subject") and tmpl.get("email_body"):
        subject = _render_template(tmpl["email_subject"], variables)
        html = _render_template(tmpl["email_body"], variables)
    else:
        subject = f"Gig Completed: {gig_title}"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0A0A0A; padding: 24px; text-align: center;">
            <h2 style="color: #F59E0B; margin: 0;">Photoo</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{lead_name}</strong>,</p>
            <p>The gig <strong>"{gig_title}"</strong> has been marked as completed.</p>
            <p>Please log in to rate your crew members and close out the gig.</p>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            Photoo · Freelance Crew Platform · India
          </div>
        </div>"""
    await send_email(db, lead_email, subject, html, "gig_completed")
