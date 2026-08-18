from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..ws_manager import manager

router = APIRouter(prefix="/api/flags", tags=["flags"])

_STATUS_ORDER = {"open": 0, "answered": 1, "resolved": 2}


@router.get("", response_model=list[schemas.FlagOut])
def list_flags(
    routed_to: str | None = None,
    site_id: str | None = None,
    status: str | None = None,
    source: str | None = None,
    db: Session = Depends(get_db),
):
    q = select(models.Flag)
    if routed_to:
        q = q.where(models.Flag.routed_to_user_id == routed_to)
    if status:
        q = q.where(models.Flag.status == status)
    if source:
        q = q.where(models.Flag.source == source)
    if site_id:
        q = q.join(models.Drawing).where(models.Drawing.site_id == site_id)
    flags = db.execute(q).scalars().all()
    flags.sort(key=lambda f: (_STATUS_ORDER.get(f.status, 9), f.created_at))
    return flags


@router.get("/{flag_id}", response_model=schemas.FlagDetailOut)
def get_flag(flag_id: str, db: Session = Depends(get_db)):
    flag = db.get(models.Flag, flag_id)
    if not flag:
        raise HTTPException(404, "Flag not found")
    return flag


@router.post("/{flag_id}/reply", response_model=schemas.FlagDetailOut)
async def reply_to_flag(flag_id: str, body: schemas.ReplyIn, db: Session = Depends(get_db)):
    flag = db.get(models.Flag, flag_id)
    if not flag:
        raise HTTPException(404, "Flag not found")
    actor = db.get(models.User, body.actor_user_id)
    msg = models.Message(
        id=models.gen_id(), flag_id=flag.id, sender="engineer",
        sender_name=actor.name if actor else None, text=body.text,
    )
    db.add(msg)
    db.add(models.AuditEvent(
        id=models.gen_id(), flag_id=flag.id, drawing_id=flag.drawing_id,
        actor=actor.name if actor else "engineer", action="replied", detail=body.text[:200],
    ))
    db.commit()
    db.refresh(flag)
    await manager.broadcast("flag_updated", schemas.FlagOut.model_validate(flag).model_dump())
    return flag


@router.post("/{flag_id}/resolve", response_model=schemas.FlagDetailOut)
async def resolve_flag(flag_id: str, body: schemas.ReplyIn | None = None, db: Session = Depends(get_db)):
    flag = db.get(models.Flag, flag_id)
    if not flag:
        raise HTTPException(404, "Flag not found")
    actor_name = "engineer"
    if body and body.actor_user_id:
        actor = db.get(models.User, body.actor_user_id)
        actor_name = actor.name if actor else actor_name
        if body.text:
            db.add(models.Message(
                id=models.gen_id(), flag_id=flag.id, sender="engineer",
                sender_name=actor_name if actor_name != "engineer" else None, text=body.text,
            ))
    flag.status = "resolved"
    flag.resolved_at = datetime.now(timezone.utc)
    db.add(models.AuditEvent(
        id=models.gen_id(), flag_id=flag.id, drawing_id=flag.drawing_id,
        actor=actor_name, action="resolved", detail="",
    ))
    db.commit()
    db.refresh(flag)
    await manager.broadcast("flag_updated", schemas.FlagOut.model_validate(flag).model_dump())
    return flag


@router.post("/{flag_id}/technician-confirm", response_model=schemas.FlagDetailOut)
async def technician_confirm(flag_id: str, db: Session = Depends(get_db)):
    flag = db.get(models.Flag, flag_id)
    if not flag:
        raise HTTPException(404, "Flag not found")
    db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="technician", text="That fixed it, thanks."))
    flag.status = "resolved"
    flag.resolved_at = datetime.now(timezone.utc)
    db.add(models.AuditEvent(
        id=models.gen_id(), flag_id=flag.id, drawing_id=flag.drawing_id,
        actor="technician", action="confirmed_resolved", detail="",
    ))
    db.commit()
    db.refresh(flag)
    await manager.broadcast("flag_updated", schemas.FlagOut.model_validate(flag).model_dump())
    return flag
