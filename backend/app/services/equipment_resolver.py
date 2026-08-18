"""Equipment / Drawing Resolver (architecture §4 step 3).

Priority order: QR/asset-tag scan-to-text > active work order > recent context
(same technician texted about the same drawing recently) > fallback numbered
list. The work-order signal isn't modeled in this prototype (no MES), so it's
skipped straight to recent-context, matching the doc's stated priority chain.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models

RECENT_WINDOW_MINUTES = 20


def resolve_drawing(
    db: Session,
    technician_id: str,
    asset_tag_drawing_id: str | None,
    site_ids: list[str],
) -> tuple[models.Drawing | None, str, list[models.Drawing]]:
    """Returns (resolved_drawing_or_None, method, candidates_if_ambiguous)."""

    if asset_tag_drawing_id:
        drawing = db.get(models.Drawing, asset_tag_drawing_id)
        if drawing:
            return drawing, "qr_asset_tag", []

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=RECENT_WINDOW_MINUTES)
    recent_flag = db.execute(
        select(models.Flag)
        .where(models.Flag.technician_id == technician_id)
        .where(models.Flag.created_at >= cutoff)
        .order_by(models.Flag.created_at.desc())
    ).scalars().first()
    if recent_flag:
        drawing = db.get(models.Drawing, recent_flag.drawing_id)
        if drawing:
            return drawing, "recent_context", []

    candidates = db.execute(
        select(models.Drawing).where(models.Drawing.site_id.in_(site_ids))
    ).scalars().all()
    return None, "fallback_ask", list(candidates)
