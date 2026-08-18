from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import cad_qa
from ..ws_manager import manager

router = APIRouter(prefix="/api/drawings", tags=["drawings"])


@router.get("", response_model=list[schemas.DrawingSummaryOut])
def list_drawings(site_id: str | None = None, db: Session = Depends(get_db)):
    q = select(models.Drawing)
    if site_id:
        q = q.where(models.Drawing.site_id == site_id)
    return db.execute(q.order_by(models.Drawing.drawing_number)).scalars().all()


@router.get("/{drawing_id}", response_model=schemas.DrawingDetailOut)
def get_drawing(drawing_id: str, db: Session = Depends(get_db)):
    drawing = db.get(models.Drawing, drawing_id)
    if not drawing:
        raise HTTPException(404, "Drawing not found")
    return drawing


@router.post("/{drawing_id}/cad-qa-scan", response_model=schemas.CadQaRunOut)
async def run_cad_qa(drawing_id: str, db: Session = Depends(get_db)):
    drawing = db.get(models.Drawing, drawing_id)
    if not drawing:
        raise HTTPException(404, "Drawing not found")
    if drawing.cad_qa_scanned:
        raise HTTPException(400, "This drawing has already been scanned")
    findings = cad_qa.run_cad_qa_scan(db, drawing)
    for f in findings:
        await manager.broadcast("flag_created", schemas.FlagOut.model_validate(f).model_dump())
    return schemas.CadQaRunOut(findings=findings)


@router.post("/{drawing_id}/close", response_model=schemas.DrawingSummaryOut)
async def close_drawing(drawing_id: str, technician_id: str = Form(...), db: Session = Depends(get_db)):
    drawing = db.get(models.Drawing, drawing_id)
    if not drawing:
        raise HTTPException(404, "Drawing not found")
    technician = db.get(models.User, technician_id)
    if drawing.status == "closed":
        raise HTTPException(400, "Drawing is already marked complete")

    drawing.status = "closed"
    drawing.closed_at = datetime.now(timezone.utc)
    db.add(models.AuditEvent(
        id=models.gen_id(), drawing_id=drawing.id,
        actor=technician.name if technician else "technician", action="drawing_closed",
        detail="Marked fully assembled by technician",
    ))
    db.commit()
    db.refresh(drawing)
    await manager.broadcast("drawing_updated", schemas.DrawingSummaryOut.model_validate(drawing).model_dump())
    return drawing
