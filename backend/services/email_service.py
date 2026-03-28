"""
Email Notification Service (Resend)
Sends transactional emails. Gracefully falls back to DB logging when API key is not set.
"""
import os
import asyncio
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _get_resend_key() -> str | None:
    return os.environ.get("RESEND_API_KEY")


def _get_sender_email() -> str:
    return os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")


async def _log_email(db, recipient: str, subject: str, event_type: str, status: str, error: str = None):
    await db.email_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "recipient": recipient,
        "subject": subject,
        "event_type": event_type,
        "status": status,
        "error": error,
        "simulated": not bool(_get_resend_key()),
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
    api_key = _get_resend_key()

    if not api_key:
        logger.info(f"[Email MOCK] To: {recipient_email} | Subject: {subject} | Event: {event_type}")
        await _log_email(db, recipient_email, subject, event_type, "simulated")
        return {"status": "simulated", "message": "No RESEND_API_KEY configured"}

    try:
        import resend
        resend.api_key = api_key
        params = {
            "from": _get_sender_email(),
            "to": [recipient_email],
            "subject": subject,
            "html": html_content,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        await _log_email(db, recipient_email, subject, event_type, "sent")
        logger.info(f"[Email] Sent to {recipient_email} | ID: {email_id}")
        return {"status": "sent", "email_id": email_id}
    except Exception as e:
        logger.error(f"[Email] Failed to send to {recipient_email}: {e}")
        await _log_email(db, recipient_email, subject, event_type, "failed", str(e))
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
            <h2 style="color: #F59E0B; margin: 0;">CrewBook</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{freelancer_name}</strong>,</p>
            <p><strong>{lead_name}</strong> has invited you to work on <strong>"{gig_title}"</strong>.</p>
            <p>Proposed fee: <strong>₹{fee:,.0f}</strong></p>
            <p>Log in to CrewBook to accept, reject, or counter this invite.</p>
            <a href="#" style="display:inline-block;background:#F59E0B;color:#000;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">View Invite</a>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            CrewBook · Freelance Crew Platform · India
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
            <h2 style="color: #F59E0B; margin: 0;">CrewBook</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{freelancer_name}</strong>,</p>
            <p>Your booking for <strong>"{gig_title}"</strong> is confirmed!</p>
            <p>Agreed fee: <strong>₹{agreed_fee:,.0f}</strong></p>
            <p>Check the gig workspace on CrewBook for details and updates.</p>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            CrewBook · Freelance Crew Platform · India
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
            <h2 style="color: #F59E0B; margin: 0;">CrewBook</h2>
          </div>
          <div style="padding: 24px; background: #ffffff;">
            <p>Hi <strong>{lead_name}</strong>,</p>
            <p>The gig <strong>"{gig_title}"</strong> has been marked as completed.</p>
            <p>Please log in to rate your crew members and close out the gig.</p>
          </div>
          <div style="padding:16px;text-align:center;color:#6B7280;font-size:12px;">
            CrewBook · Freelance Crew Platform · India
          </div>
        </div>"""
    await send_email(db, lead_email, subject, html, "gig_completed")
