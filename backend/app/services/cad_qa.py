"""Proactive CAD-QA agent (architecture §6). Runs against a newly-ingested
drawing *before* any technician sees it: deterministic checks first, then a
critic-agent pass over spatial/symbolic callouts. Findings become flags with
source=cad_qa, region_id set directly (no photo, no technician thread), routed
to the drawing's author to confirm.

Tier 1 (deterministic) is real for any drawing ingested via DXF upload —
see `cad_qa_checks.py`, which runs at ingest time against the drawing's own
parsed geometry and populates `Drawing.cad_qa_findings` for real. This
module just turns whatever findings ended up on the drawing (real, from
cad_qa_checks.py, or seed-time hand-authored ones standing in for what tier
2's critic-agent pass would add) into flags — it doesn't care which kind
they are.
"""
from sqlalchemy.orm import Session

from .. import models
from . import routing


def run_cad_qa_scan(db: Session, drawing: models.Drawing) -> list[models.Flag]:
    created: list[models.Flag] = []
    routed_to, _ = routing.route_flag(db, drawing)

    for finding in drawing.cad_qa_findings or []:
        flag = models.Flag(
            drawing_id=drawing.id,
            region_id=finding.get("region_id"),
            x=finding.get("x", 50),
            y=finding.get("y", 50),
            status="open",
            source="cad_qa",
            note=finding["finding"],
            ai_confidence=finding.get("confidence"),
            ai_reasoning=finding.get("reasoning", "Flagged by deterministic consistency check."),
            routed_to_user_id=routed_to,
        )
        db.add(flag)
        db.flush()
        db.add(models.Message(
            flag_id=flag.id,
            sender="ai",
            sender_name="Redline AI",
            text=finding["finding"],
        ))
        db.add(models.AuditEvent(
            flag_id=flag.id,
            drawing_id=drawing.id,
            actor="cad_qa_agent",
            action="finding_created",
            detail=finding.get("check_type", "consistency_check"),
        ))
        created.append(flag)

    drawing.cad_qa_scanned = True
    db.commit()
    for f in created:
        db.refresh(f)
    return created
