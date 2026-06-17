"""
PDF Contract Generation Service
Generates booking contracts when gig invites are accepted.
Uses reportlab for pure-Python PDF generation.
"""
import io
import logging
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logger = logging.getLogger(__name__)

BRAND_GOLD = colors.HexColor("#F59E0B")
BRAND_DARK = colors.HexColor("#0A0A0A")
BRAND_GREY = colors.HexColor("#6B7280")
SECTION_BG = colors.HexColor("#F9FAFB")


def generate_contract_pdf(
    gig: dict,
    invite: dict,
    lead_user: dict,
    freelancer_user: dict,
) -> bytes:
    """Generate a PDF contract and return as bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"Photoo Contract – {gig.get('title', 'Gig')}",
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ContractTitle",
        parent=styles["Heading1"],
        fontSize=20,
        textColor=BRAND_DARK,
        alignment=TA_CENTER,
        spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "ContractSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=BRAND_GREY,
        alignment=TA_CENTER,
        spaceAfter=2,
    )
    section_header_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Normal"],
        fontSize=11,
        textColor=BRAND_DARK,
        fontName="Helvetica-Bold",
        spaceBefore=12,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#374151"),
        spaceAfter=4,
        leading=14,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=8,
        textColor=BRAND_GREY,
        fontName="Helvetica-Bold",
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph("Photoo", title_style))
    story.append(Paragraph("Freelance Crew Booking Contract", subtitle_style))
    story.append(Paragraph(
        f"Contract ID: {invite.get('id', invite.get('_id', 'N/A'))}",
        ParagraphStyle("SmallCenter", parent=subtitle_style, fontSize=8)
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND_GOLD, spaceAfter=14, spaceBefore=8))

    # ── Date ──────────────────────────────────────────────────────────────────
    now_str = datetime.now(timezone.utc).strftime("%d %B %Y")
    story.append(Paragraph(f"Generated on: {now_str}", ParagraphStyle("DateRight", parent=body_style, alignment=TA_RIGHT, fontSize=8, textColor=BRAND_GREY)))
    story.append(Spacer(1, 0.3 * cm))

    # ── Parties ───────────────────────────────────────────────────────────────
    story.append(Paragraph("PARTIES TO THIS CONTRACT", section_header_style))

    party_data = [
        [
            Paragraph("<b>LEAD PHOTOGRAPHER (Client)</b>", label_style),
            Paragraph("<b>FREELANCER (Service Provider)</b>", label_style),
        ],
        [
            Paragraph(lead_user.get("full_name", "N/A"), body_style),
            Paragraph(freelancer_user.get("full_name", "N/A"), body_style),
        ],
        [
            Paragraph(lead_user.get("phone", "N/A"), body_style),
            Paragraph(freelancer_user.get("phone", "N/A"), body_style),
        ],
        [
            Paragraph(lead_user.get("location", "N/A"), body_style),
            Paragraph(freelancer_user.get("location", "N/A"), body_style),
        ],
    ]
    party_table = Table(party_data, colWidths=["50%", "50%"])
    party_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SECTION_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(party_table)
    story.append(Spacer(1, 0.3 * cm))

    # ── Gig Details ───────────────────────────────────────────────────────────
    story.append(Paragraph("GIG DETAILS", section_header_style))

    gig_data = [
        [Paragraph("<b>Field</b>", label_style), Paragraph("<b>Details</b>", label_style)],
        [Paragraph("Gig Title", body_style), Paragraph(gig.get("title", "N/A"), body_style)],
        [Paragraph("Description", body_style), Paragraph(gig.get("description", "—") or "—", body_style)],
        [Paragraph("Booked Role", body_style), Paragraph(invite.get("role", "N/A"), body_style)],
        [Paragraph("Agreed Fee", body_style), Paragraph(f"₹{(invite.get('agreed_fee') or invite.get('proposed_fee', 0)):,.0f}", body_style)],
        [Paragraph("Status", body_style), Paragraph("Accepted / Confirmed", body_style)],
    ]
    gig_table = Table(gig_data, colWidths=["35%", "65%"])
    gig_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SECTION_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(gig_table)
    story.append(Spacer(1, 0.3 * cm))

    # ── Sessions ──────────────────────────────────────────────────────────────
    sessions = gig.get("sessions", [])
    if sessions:
        story.append(Paragraph("SESSIONS / SCHEDULE", section_header_style))
        sess_data = [
            [
                Paragraph("<b>Event Type</b>", label_style),
                Paragraph("<b>Date</b>", label_style),
                Paragraph("<b>Time</b>", label_style),
                Paragraph("<b>Location</b>", label_style),
            ]
        ]
        for s in sessions:
            sess_data.append([
                Paragraph(s.get("event_type", "—"), body_style),
                Paragraph(s.get("date", "—"), body_style),
                Paragraph(f"{s.get('start_time', '—')} – {s.get('end_time', '—')}", body_style),
                Paragraph(f"{s.get('location', '—')}{' · ' + s['venue_name'] if s.get('venue_name') else ''}", body_style),
            ])
        sess_table = Table(sess_data, colWidths=["20%", "20%", "25%", "35%"])
        sess_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), SECTION_BG),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(sess_table)
        story.append(Spacer(1, 0.3 * cm))

    # ── Terms ─────────────────────────────────────────────────────────────────
    story.append(Paragraph("TERMS & CONDITIONS", section_header_style))
    terms = [
        "1. <b>Payment:</b> The agreed fee of ₹{fee:,.0f} is payable upon completion of the gig as per platform terms.".format(
            fee=invite.get("agreed_fee") or invite.get("proposed_fee", 0)
        ),
        "2. <b>Cancellation:</b> Either party must notify the other at least 48 hours before the first session. Late cancellations may attract a penalty as per Photoo policy.",
        "3. <b>Data Handover:</b> All raw files must be handed over to the Lead Photographer within the timeline agreed in the workspace.",
        "4. <b>Conduct:</b> Both parties agree to maintain professional conduct and adhere to Photoo's community guidelines.",
        "5. <b>Confidentiality:</b> Client details, shoot locations, and any personal information shared are strictly confidential.",
        "6. <b>Dispute Resolution:</b> Any disputes will be resolved via Photoo's arbitration process.",
        "7. <b>Platform:</b> This contract is facilitated by Photoo (photoo.in) and is subject to platform terms of service.",
    ]
    for t in terms:
        story.append(Paragraph(t, body_style))
    story.append(Spacer(1, 0.5 * cm))

    # ── Signature Block ───────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB"), spaceAfter=10))
    sig_data = [
        [
            Paragraph("____________________________", body_style),
            Paragraph("____________________________", body_style),
        ],
        [
            Paragraph(f"<b>{lead_user.get('full_name', 'Lead Photographer')}</b>", body_style),
            Paragraph(f"<b>{freelancer_user.get('full_name', 'Freelancer')}</b>", body_style),
        ],
        [
            Paragraph("Lead Photographer", ParagraphStyle("SigRole", parent=body_style, textColor=BRAND_GREY, fontSize=8)),
            Paragraph("Freelancer / Service Provider", ParagraphStyle("SigRole", parent=body_style, textColor=BRAND_GREY, fontSize=8)),
        ],
        [
            Paragraph("Date: _______________", ParagraphStyle("SigDate", parent=body_style, fontSize=8, textColor=BRAND_GREY)),
            Paragraph("Date: _______________", ParagraphStyle("SigDate", parent=body_style, fontSize=8, textColor=BRAND_GREY)),
        ],
    ]
    sig_table = Table(sig_data, colWidths=["50%", "50%"])
    sig_table.setStyle(TableStyle([
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(sig_table)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB"), spaceAfter=4))
    story.append(Paragraph(
        "This document was auto-generated by Photoo · photoo.in · Not a legally binding document without physical signatures.",
        ParagraphStyle("Footer", parent=body_style, fontSize=7, textColor=BRAND_GREY, alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()
