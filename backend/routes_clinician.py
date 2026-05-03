"""Clinician view routes (read-only, anonymization-aware)."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, timedelta
import hashlib
import io

from auth import require_role, get_db, write_audit
from risk_engine import detect_patterns

router = APIRouter(prefix="/api/clinician", tags=["clinician"])


async def require_verified_clinician(user=Depends(require_role("clinician"))):
    if not user.get("verified_clinician"):
        raise HTTPException(
            status_code=403,
            detail="Clinician not verified. Contact an administrator for an invite code.",
        )
    return user


def _anon_id(uid: str) -> str:
    return "P-" + hashlib.sha256(uid.encode()).hexdigest()[:6].upper()


@router.get("/patients")
async def list_patients(user=Depends(require_verified_clinician)):
    db = get_db()
    # Clinician sees all recovery_users (simulation), but names are hidden
    # when the user has enabled anonymize_clinician_view (default True).
    cursor = db.users.find({"role": "recovery_user"}, {"_id": 0, "password_hash": 0})
    users = await cursor.to_list(200)
    out = []
    for u in users:
        consent = await db.consents.find_one({"user_id": u["id"]}, {"_id": 0}) or {}
        anon = consent.get("anonymize_clinician_view", True)
        latest_risk = await db.risk_scores.find_one(
            {"user_id": u["id"]}, {"_id": 0}, sort=[("entry_date", -1)],
        )
        alerts_count = await db.alerts.count_documents(
            {"user_id": u["id"], "level": {"$in": ["medium", "high"]}, "acknowledged": False}
        )
        out.append({
            "id": u["id"],
            "display_name": _anon_id(u["id"]) if anon else u["name"],
            "anonymized": anon,
            "latest_risk": (
                {"score": latest_risk["displayed_score"], "level": latest_risk["level"],
                 "entry_date": latest_risk["entry_date"]} if latest_risk else None
            ),
            "open_alerts": alerts_count,
        })
    # Sort high-risk first
    def _k(x):
        order = {"high": 0, "medium": 1, "low": 2, None: 3}
        return order.get(x["latest_risk"]["level"] if x["latest_risk"] else None, 3)
    out.sort(key=_k)
    await write_audit(user, "clinician_list_patients", meta={"count": len(out)})
    return out


@router.get("/patients/{patient_id}")
async def patient_detail(patient_id: str, user=Depends(require_verified_clinician)):
    db = get_db()
    u = await db.users.find_one({"id": patient_id, "role": "recovery_user"}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Patient not found")
    consent = await db.consents.find_one({"user_id": patient_id}, {"_id": 0}) or {}
    anon = consent.get("anonymize_clinician_view", True)

    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    entries = await db.health_entries.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(200)
    risks = await db.risk_scores.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0}
    ).sort("entry_date", 1).to_list(200)
    patterns = detect_patterns(entries[-7:] if len(entries) >= 3 else entries)

    await write_audit(user, "clinician_view_patient",
                      target_user_id=patient_id, target_email=u.get("email"),
                      meta={"anonymized": anon, "entries_returned": len(entries)})

    return {
        "id": u["id"],
        "display_name": _anon_id(u["id"]) if anon else u["name"],
        "anonymized": anon,
        "entries": entries,
        "risks": risks,
        "flagged_patterns": patterns,
    }


@router.get("/overview")
async def overview(user=Depends(require_verified_clinician)):
    """Aggregate risk distribution across population."""
    db = get_db()
    users = await db.users.find({"role": "recovery_user"}, {"_id": 0}).to_list(200)
    dist = {"low": 0, "medium": 0, "high": 0, "no_data": 0}
    for u in users:
        r = await db.risk_scores.find_one(
            {"user_id": u["id"]}, {"_id": 0}, sort=[("entry_date", -1)]
        )
        if not r:
            dist["no_data"] += 1
        else:
            dist[r["level"]] = dist.get(r["level"], 0) + 1
    total = len(users)
    return {"total_patients": total, "risk_distribution": dist}



@router.get("/patients/{patient_id}/report.pdf")
async def patient_pdf_report(patient_id: str, user=Depends(require_verified_clinician)):
    """Generate a clinician-grade PDF: risk trends, recovery score,
    insights, and XAI feature contributions for last 30 days.
    Respects anonymize_clinician_view consent.
    """
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    )

    db = get_db()
    u = await db.users.find_one({"id": patient_id, "role": "recovery_user"}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Patient not found")
    consent = await db.consents.find_one({"user_id": patient_id}, {"_id": 0}) or {}
    anon = consent.get("anonymize_clinician_view", True)
    display_name = _anon_id(u["id"]) if anon else u["name"]

    start = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
    entries = await db.health_entries.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0},
    ).sort("entry_date", 1).to_list(200)
    risks = await db.risk_scores.find(
        {"user_id": patient_id, "entry_date": {"$gte": start}}, {"_id": 0},
    ).sort("entry_date", 1).to_list(200)
    alerts = await db.alerts.find(
        {"user_id": patient_id}, {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    patterns = detect_patterns(entries[-7:] if len(entries) >= 3 else entries)
    latest_risk = risks[-1] if risks else None

    sobriety_start = u.get("sobriety_start_date")
    days_sober = None
    if sobriety_start:
        try:
            d0 = datetime.strptime(sobriety_start, "%Y-%m-%d").date()
            days_sober = (datetime.now(timezone.utc).date() - d0).days
        except Exception:
            days_sober = None
    longest_streak = int(u.get("longest_streak_days", 0) or 0)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title=f"Own Recovery Clinical Report — {display_name}",
    )
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#0F766E"))
    h2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#0F172A"), spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("Body", parent=ss["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=colors.HexColor("#1E293B"))
    caption = ParagraphStyle("Cap", parent=body, fontSize=8, textColor=colors.HexColor("#64748B"))

    story = []
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Paragraph("Own Recovery — Clinical Decision-Support Report", h1))
    story.append(Paragraph(
        f"Patient: <b>{display_name}</b> {'(anonymized per consent)' if anon else '(name visible per consent)'} "
        f"&nbsp;|&nbsp; Generated: {generated_at} &nbsp;|&nbsp; Clinician: {user.get('name','—')}",
        caption,
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<i>Decision-support only. This document is generated by a behavioral-health risk monitoring "
        "system and does not constitute a medical diagnosis. Use alongside clinical judgment.</i>",
        caption,
    ))
    story.append(Spacer(1, 14))

    if latest_risk:
        snap_rows = [
            ["Latest risk score", f"{latest_risk['displayed_score']:.0f} / 100", latest_risk["level"].upper()],
            ["Entry date", latest_risk["entry_date"], ""],
            ["Days sober", str(days_sober) if days_sober is not None else "—", ""],
            ["Longest streak", f"{longest_streak} days", ""],
            ["Open alerts (med/high)", str(sum(1 for a in alerts if a["level"] in ("medium","high") and not a.get("acknowledged"))), ""],
        ]
    else:
        snap_rows = [
            ["Latest risk score", "—", ""],
            ["Days sober", str(days_sober) if days_sober is not None else "—", ""],
            ["Longest streak", f"{longest_streak} days", ""],
            ["Open alerts", "—", ""],
        ]
    story.append(Paragraph("Snapshot", h2))
    snap_tbl = Table(snap_rows, colWidths=[2.2*inch, 2.2*inch, 1.8*inch])
    snap_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ("BOX", (0,0), (-1,-1), 0.4, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8F0")),
        ("FONT", (0,0), (-1,-1), "Helvetica", 9.5),
        ("FONT", (0,0), (0,-1), "Helvetica-Bold", 9.5),
        ("TEXTCOLOR", (2,0), (2,0), colors.HexColor(
            "#16A34A" if latest_risk and latest_risk["level"]=="low"
            else "#D97706" if latest_risk and latest_risk["level"]=="medium"
            else "#DC2626" if latest_risk else "#475569"
        )),
        ("PADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(snap_tbl)

    story.append(Paragraph("Risk &amp; signal trend — last 14 days", h2))
    last14 = list(zip(entries[-14:], risks[-14:])) if entries and risks else []
    if last14:
        rows = [["Date", "Mood", "Craving", "Sleep (h)", "Stress", "Risk", "Level"]]
        for e, r in last14:
            rows.append([
                e["entry_date"], str(e["mood"]), str(e["craving"]),
                f"{e['sleep_hours']:.1f}", str(e["stress"]),
                f"{r['displayed_score']:.0f}", r["level"].upper(),
            ])
        tt = Table(rows, repeatRows=1, colWidths=[0.95*inch, 0.55*inch, 0.7*inch, 0.7*inch, 0.6*inch, 0.55*inch, 0.7*inch])
        tt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0F766E")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONT", (0,0), (-1,0), "Helvetica-Bold", 9),
            ("FONT", (0,1), (-1,-1), "Helvetica", 8.5),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8F0")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("PADDING", (0,0), (-1,-1), 4),
            ("ALIGN", (1,1), (-1,-1), "CENTER"),
        ]))
        story.append(tt)
    else:
        story.append(Paragraph("No entries available for the selected window.", body))

    story.append(Paragraph("Explainable AI — latest feature contributions", h2))
    story.append(Paragraph(
        "Each row shows how a tracked signal moved the risk score for the most recent entry. "
        "Positive contributions raise risk; negative reduce it.",
        caption,
    ))
    story.append(Spacer(1, 4))
    if latest_risk and latest_risk.get("contributions"):
        rows = [["Signal", "Value", "Direction", "Contribution (pts)"]]
        for c in latest_risk["contributions"]:
            rows.append([
                c.get("label") or c["feature"],
                f"{c['value']}",
                c["direction"],
                f"{c['contribution']:+.1f}",
            ])
        xai_tbl = Table(rows, repeatRows=1, colWidths=[2.3*inch, 1.2*inch, 1.3*inch, 1.3*inch])
        xai_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1F2937")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONT", (0,0), (-1,0), "Helvetica-Bold", 9),
            ("FONT", (0,1), (-1,-1), "Helvetica", 9),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8F0")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
            ("ALIGN", (3,1), (3,-1), "RIGHT"),
            ("PADDING", (0,0), (-1,-1), 4),
        ]))
        story.append(xai_tbl)
        if latest_risk.get("narrative"):
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"<b>Narrative:</b> {latest_risk['narrative']}", body))
    else:
        story.append(Paragraph("No XAI contributions available.", body))

    story.append(Paragraph("Detected patterns (last 7-day window)", h2))
    if patterns:
        for p in patterns:
            story.append(Paragraph(
                f"<b>{p['title']}</b> &nbsp;<font color='#64748B'>[{p['level'].upper()}]</font><br/>"
                f"{p['description']}<br/>"
                f"<i>Suggested action:</i> {p['suggested_action']}",
                body,
            ))
            story.append(Spacer(1, 4))
    else:
        story.append(Paragraph("No patterns flagged in recent window.", body))

    story.append(Paragraph("Alerts log (most recent 10)", h2))
    if alerts:
        rows = [["Created", "Kind", "Level", "Title", "Ack."]]
        for a in alerts[:10]:
            rows.append([
                a["created_at"][:10], a["kind"], a["level"].upper(),
                a["title"][:60], "Yes" if a.get("acknowledged") else "No",
            ])
        at = Table(rows, repeatRows=1, colWidths=[0.9*inch, 0.7*inch, 0.65*inch, 3.2*inch, 0.55*inch])
        at.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#0F766E")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONT", (0,0), (-1,0), "Helvetica-Bold", 8.5),
            ("FONT", (0,1), (-1,-1), "Helvetica", 8.5),
            ("INNERGRID", (0,0), (-1,-1), 0.25, colors.HexColor("#E2E8F0")),
            ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#94A3B8")),
            ("PADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(at)
    else:
        story.append(Paragraph("No alerts on file.", body))

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f"<b>Audit:</b> Generated by clinician <b>{user.get('email','—')}</b> at {generated_at}. "
        f"Anonymization: <b>{'ON' if anon else 'OFF'}</b>. "
        f"Source: Own Recovery (rule-based + scikit-learn logistic regression).",
        caption,
    ))

    doc.build(story)
    buf.seek(0)

    try:
        await write_audit(user, "export_patient_pdf",
                          target_user_id=patient_id, target_email=u.get("email"),
                          meta={"anonymized": anon, "display_name": display_name})
    except Exception:
        pass

    filename = f"own-recovery-report-{display_name}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
