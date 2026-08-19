from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/sites", tags=["sites"])


def _site_summary(db: Session, site: models.Site) -> schemas.SiteSummaryOut:
    drawings = list(db.execute(select(models.Drawing).where(models.Drawing.site_id == site.id)).scalars())
    drawing_ids = {d.id for d in drawings}
    flags = [
        f for f in db.execute(select(models.Flag)).scalars()
        if f.drawing_id in drawing_ids
    ]
    open_n = sum(1 for f in flags if f.status == "open")
    tentative_n = sum(1 for f in flags if f.status == "answered")
    resolved_n = sum(1 for f in flags if f.status == "resolved")
    total = open_n + tentative_n + resolved_n
    collaborators = [u for u in db.execute(select(models.User)).scalars() if site.id in (u.site_ids or [])]
    return schemas.SiteSummaryOut(
        id=site.id, name=site.name, org_id=site.org_id,
        drawing_count=len(drawings),
        active_drawing_count=sum(1 for d in drawings if d.status == "active"),
        open_flag_count=open_n,
        tentative_flag_count=tentative_n,
        resolved_flag_count=resolved_n,
        resolution_rate=round(100 * resolved_n / total) if total else 0,
        collaborator_count=len(collaborators),
    )


@router.get("", response_model=list[schemas.SiteSummaryOut])
def list_sites(db: Session = Depends(get_db)):
    sites = db.execute(select(models.Site).order_by(models.Site.name)).scalars().all()
    return [_site_summary(db, s) for s in sites]


@router.get("/{site_id}/overview", response_model=schemas.SiteOverviewOut)
def site_overview(site_id: str, db: Session = Depends(get_db)):
    site = db.get(models.Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    summary = _site_summary(db, site)

    drawings = list(db.execute(select(models.Drawing).where(models.Drawing.site_id == site_id)).scalars())
    drawing_by_id = {d.id: d for d in drawings}
    flags = [f for f in db.execute(select(models.Flag)).scalars() if f.drawing_id in drawing_by_id]
    engineers = [
        u for u in db.execute(select(models.User).where(models.User.role == "engineer")).scalars()
        if site_id in (u.site_ids or [])
    ]

    disciplines = sorted({d.discipline for d in drawings})
    workstreams: list[schemas.WorkstreamOut] = []
    for disc in disciplines:
        disc_drawings = [d for d in drawings if d.discipline == disc]
        disc_drawing_ids = {d.id for d in disc_drawings}
        disc_flags = [f for f in flags if f.drawing_id in disc_drawing_ids]
        owner = next((e for e in engineers if e.discipline == disc), None)
        if owner is None and disc_drawings:
            owner = db.get(models.User, disc_drawings[0].primary_author_id)
        workstreams.append(schemas.WorkstreamOut(
            discipline=disc,
            drawing_count=len(disc_drawings),
            open_flag_count=sum(1 for f in disc_flags if f.status != "resolved"),
            resolved_flag_count=sum(1 for f in disc_flags if f.status == "resolved"),
            owner_id=owner.id if owner else None,
            owner_name=owner.name if owner else None,
            owner_avatar_color=owner.avatar_color if owner else None,
            owner_avatar_url=owner.avatar_url if owner else None,
        ))
    workstreams.sort(key=lambda w: -w.open_flag_count)

    return schemas.SiteOverviewOut(site=summary, workstreams=workstreams)


@router.get("/{site_id}/activity", response_model=list[schemas.AuditEventOut])
def site_activity(site_id: str, limit: int = 50, db: Session = Depends(get_db)):
    site = db.get(models.Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    drawing_ids = {
        d.id for d in db.execute(select(models.Drawing).where(models.Drawing.site_id == site_id)).scalars()
    }
    flag_ids = {f.id for f in db.execute(select(models.Flag)).scalars() if f.drawing_id in drawing_ids}
    events = db.execute(
        select(models.AuditEvent).order_by(models.AuditEvent.created_at.desc())
    ).scalars().all()
    scoped = [
        e for e in events
        if (e.drawing_id and e.drawing_id in drawing_ids)
        or (e.flag_id and e.flag_id in flag_ids)
        or e.site_id == site_id
    ]
    return scoped[:limit]


@router.get("/{site_id}/collaborators", response_model=list[schemas.UserOut])
def site_collaborators(site_id: str, db: Session = Depends(get_db)):
    site = db.get(models.Site, site_id)
    if not site:
        raise HTTPException(404, "Site not found")
    users = db.execute(select(models.User).order_by(models.User.role, models.User.name)).scalars().all()
    return [u for u in users if site_id in (u.site_ids or [])]
