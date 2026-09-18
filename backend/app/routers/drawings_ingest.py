from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import auth, cad_qa_checks, ingest, region_labeling, title_block_ocr

router = APIRouter(prefix="/api/drawings", tags=["drawings-ingest"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
# Same margin ingest._cluster used to group entities into a region in the
# first place, just generous enough to catch a label sitting just outside
# its own cluster's bounding box (very common — a designator is often
# printed just above/beside its symbol, not literally inside it).
LABEL_SEARCH_RADIUS = 0.015 * max(ingest.W, ingest.H) * region_labeling.MAX_LABEL_SEARCH_MULTIPLE


@router.post("/ingest", response_model=schemas.IngestWarningsOut)
async def ingest_drawing(
    file: UploadFile = File(...),
    drawing_number: str = Form(...),
    revision: str = Form(...),
    title: str = Form(...),
    discipline: str = Form(...),
    site_id: str = Form(...),
    primary_author_id: str = Form(...),
    context_block: str = Form(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if not db.get(models.Site, site_id):
        raise HTTPException(404, "Unknown site")
    author = db.get(models.User, primary_author_id)
    if not author or author.role not in ("engineer", "reviewer"):
        raise HTTPException(404, "Unknown engineer")
    auth.require_engineer(current_user)
    if current_user.id != author.id and current_user.role not in ("reviewer", "admin"):
        raise HTTPException(403, "Can only ingest a drawing as yourself")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 25MB)")

    try:
        parsed = ingest.parse_upload(file.filename or "", data)
    except ingest.UnsupportedFormat as e:
        raise HTTPException(422, str(e)) from e

    drawing = models.Drawing(
        id=models.gen_id(), site_id=site_id, drawing_number=drawing_number, revision=revision,
        title=title, discipline=discipline, primary_author_id=primary_author_id, backup_author_ids=[],
        context_block=context_block, revision_notes="", confidence_floor_status="needs_review",
        layout=parsed.layout, cad_qa_findings=[], cad_qa_scanned=False,
    )
    db.add(drawing)
    db.flush()
    title_block_ocr.save_title_block_image(drawing, author.name)

    region_refs: list[cad_qa_checks.RegionRef] = []
    for i, region in enumerate(parsed.regions):
        px, py, pw, ph = region.px
        bbox_px = (px, py, px + pw, py + ph)
        # Real region auto-labeling (region_labeling.py) — a deterministic
        # proximity read of the drawing's own real text entities, not a
        # placeholder. Falls back to the honest generic label when nothing
        # legible is nearby, same fail-closed shape as title_block_ocr.py.
        proposal = (
            region_labeling.propose_label(bbox_px, parsed.text_entities, LABEL_SEARCH_RADIUS)
            if parsed.text_entities else None
        )
        if proposal:
            label = proposal.label
            description = (
                f"Auto-detected cluster of {region.weight} drawing entities, labeled from the nearby "
                f"{'reference designator' if proposal.from_designator else 'text'} \"{proposal.source_text}\" "
                f"— confirm or rename."
            )
        else:
            label = f"Region {i + 1}"
            description = f"Auto-detected cluster of {region.weight} drawing entities — rename and confirm."
        db_region = models.Region(
            id=models.gen_id(), drawing_id=drawing.id, label=label, description=description,
            keywords=[], known_issues=[],
            bbox_x=round(px / ingest.W * 100, 2), bbox_y=round(py / ingest.H * 100, 2),
            bbox_w=round(pw / ingest.W * 100, 2), bbox_h=round(ph / ingest.H * 100, 2),
        )
        db.add(db_region)
        db.flush()
        region_refs.append(cad_qa_checks.RegionRef(id=db_region.id, label=db_region.label, bbox=bbox_px))

    # Real tier-1 CAD-QA (services/cad_qa_checks.py) — only meaningful for
    # DXF, where we have real text/line entity geometry to check, not just
    # a flattened shape list. `checks_available` is what lets the UI tell
    # "scanned, clean" apart from "no detection logic ran on this drawing."
    if parsed.checks_available:
        drawing.cad_qa_findings = cad_qa_checks.run_deterministic_checks(
            parsed.text_entities, parsed.line_segments, region_refs, parsed.circle_centers,
        )
        drawing.cad_qa_checks_available = True

    db.add(models.AuditEvent(
        id=models.gen_id(), drawing_id=drawing.id, actor=author.name, action="ingested",
        detail=f"{file.filename} → {len(parsed.regions)} auto-suggested region(s)",
    ))
    db.commit()
    db.refresh(drawing)

    return schemas.IngestWarningsOut(drawing=drawing, warnings=parsed.warnings)


@router.put("/{drawing_id}/regions", response_model=schemas.DrawingDetailOut)
def update_regions(
    drawing_id: str, body: schemas.RegionsUpdateIn, db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    drawing = db.get(models.Drawing, drawing_id)
    if not drawing:
        raise HTTPException(404, "Drawing not found")

    existing_by_id = {r.id: r for r in drawing.regions}
    keep_ids = set()
    for r in body.regions:
        if r.id and r.id in existing_by_id:
            region = existing_by_id[r.id]
            region.label, region.description = r.label, r.description
            region.bbox_x, region.bbox_y, region.bbox_w, region.bbox_h = r.bbox_x, r.bbox_y, r.bbox_w, r.bbox_h
            keep_ids.add(r.id)
        else:
            new_region = models.Region(
                id=models.gen_id(), drawing_id=drawing.id, label=r.label, description=r.description,
                keywords=[], known_issues=[], bbox_x=r.bbox_x, bbox_y=r.bbox_y, bbox_w=r.bbox_w, bbox_h=r.bbox_h,
            )
            db.add(new_region)
            db.flush()
            keep_ids.add(new_region.id)

    for r in drawing.regions:
        if r.id not in keep_ids and not db.query(models.Flag).filter(models.Flag.region_id == r.id).first():
            db.delete(r)

    db.commit()
    db.refresh(drawing)
    return drawing


@router.post("/{drawing_id}/confirm", response_model=schemas.DrawingDetailOut)
def confirm_drawing(
    drawing_id: str, actor_user_id: str = Form(...), db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    auth.require_engineer(current_user)
    drawing = db.get(models.Drawing, drawing_id)
    if not drawing:
        raise HTTPException(404, "Drawing not found")
    if not drawing.regions:
        raise HTTPException(400, "Add at least one region before confirming")

    drawing.confidence_floor_status = "verified"
    db.add(models.AuditEvent(
        id=models.gen_id(), drawing_id=drawing.id, actor=current_user.name,
        action="regions_confirmed", detail=f"{len(drawing.regions)} region(s)",
    ))
    db.commit()
    db.refresh(drawing)
    return drawing
