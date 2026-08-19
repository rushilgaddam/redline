from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import equipment_resolver, knowledge_reuse, routing, title_block_ocr, vision_agent
from ..ws_manager import manager

router = APIRouter(prefix="/api/sms", tags=["sms"])

PHOTO_HINTS = {
    "mock:breaker_cb3": "breaker cb-3 cubicle scorched panel",
    "mock:contactor_bank": "contactor bank k1 k2 k3 k4 coil",
    "mock:ground_bus": "ground bus bar corrosion",
    "mock:door_interlock": "door interlock switch plunger",
    "mock:terminal_strip": "terminal strip tb-1 wiring",
    "mock:transformer": "control transformer t1",
    "mock:mounting_slot": "mounting slot bracket motor",
    "mock:belt_tensioner": "belt tensioner spring arm",
    "mock:base_plate": "motor base plate bolt",
    "mock:coupling_guard": "coupling guard shaft",
    "mock:lube_port": "lubrication port grease fitting",
    "mock:main_breaker": "main breaker 800a",
    "mock:feeder_breaker": "feeder breaker f3",
    "mock:ct_meter": "ct compartment current transformer meter",
    "mock:relay_panel": "relay panel protection",
    "mock:general_floor": "equipment floor photo",
}


@router.get("/thread/{technician_id}", response_model=list[schemas.FlagOut])
def technician_thread(technician_id: str, db: Session = Depends(get_db)):
    q = select(models.Flag).where(models.Flag.technician_id == technician_id).order_by(models.Flag.created_at)
    return db.execute(q).scalars().all()


@router.get("/conversation/{technician_id}")
def technician_conversation(technician_id: str, db: Session = Depends(get_db)):
    flags = db.execute(
        select(models.Flag).where(models.Flag.technician_id == technician_id)
    ).scalars().all()
    drawing_cache: dict[str, models.Drawing | None] = {}
    items = []
    for flag in flags:
        if flag.drawing_id not in drawing_cache:
            drawing_cache[flag.drawing_id] = db.get(models.Drawing, flag.drawing_id)
        drawing = drawing_cache[flag.drawing_id]
        region = db.get(models.Region, flag.region_id) if flag.region_id else None
        for msg in flag.messages:
            items.append({
                "flag_id": flag.id,
                "drawing_id": flag.drawing_id,
                "drawing_number": drawing.drawing_number if drawing else None,
                "drawing_title": drawing.title if drawing else None,
                "region_label": region.label if region else None,
                "status": flag.status,
                "source": flag.source,
                "sender": msg.sender,
                "sender_name": msg.sender_name,
                "text": msg.text,
                "photo_ref": msg.photo_ref,
                "created_at": msg.created_at,
            })
    items.sort(key=lambda i: i["created_at"])
    return items


@router.post("/inbound", response_model=schemas.SmsInboundOut)
async def sms_inbound(body: schemas.SmsInboundIn, db: Session = Depends(get_db)):
    technician = db.get(models.User, body.technician_id)
    if not technician or technician.role != "technician":
        raise HTTPException(404, "Unknown technician")

    tech_site_ids = technician.site_ids or []
    current_site_id = body.site_id if body.site_id in tech_site_ids else (
        tech_site_ids[0] if len(tech_site_ids) == 1 else None
    )

    drawing, method, candidates, ocr_note = None, "", [], None
    if body.title_block_photo_drawing_id:
        image_path = title_block_ocr.title_block_path(body.title_block_photo_drawing_id)
        ocr_drawing, ocr_fields = title_block_ocr.resolve_by_title_block(db, image_path)
        if ocr_drawing:
            drawing, method = ocr_drawing, "title_block_ocr"
            ocr_note = f"Read title block: {ocr_fields['drawing_number']} Rev {ocr_fields['revision'] or '?'}."
        else:
            db.add(models.AuditEvent(
                id=models.gen_id(), actor="title_block_ocr", action="ocr_resolution_failed",
                detail=f"raw_text={ocr_fields['raw_text'][:200]!r}",
            ))

    if not drawing:
        drawing, method, candidates = equipment_resolver.resolve_drawing(
            db, technician.id, body.asset_tag_drawing_id or body.drawing_id_override, tech_site_ids, current_site_id
        )

    if not drawing:
        return schemas.SmsInboundOut(
            flag=None,
            reply_text="Which equipment is this about? " + " ".join(
                f"{i+1}. {c.drawing_number} — {c.title}" for i, c in enumerate(candidates)
            ),
            candidates=candidates,
        )

    site_documents = db.execute(
        select(models.KnowledgeDocument)
        .join(models.KnowledgeSource, models.KnowledgeDocument.source_id == models.KnowledgeSource.id)
        .where(models.KnowledgeDocument.site_id == drawing.site_id)
        .where(models.KnowledgeSource.status == "connected")
    ).scalars().all()

    photo_hint = PHOTO_HINTS.get(body.photo_ref or "", "")
    vision = vision_agent.run_vision_agent(body.text, photo_hint, drawing.regions, site_documents)

    needs_review = drawing.confidence_floor_status == "needs_review"
    answered = vision.supported and not needs_review

    routed_to, used_backup = routing.route_flag(db, drawing)
    reuse_match = knowledge_reuse.find_similar_resolution(
        db, drawing.id, vision.region.id if vision.region else None, body.text
    )

    flag = models.Flag(
        id=models.gen_id(), drawing_id=drawing.id,
        region_id=vision.region.id if vision.region else None,
        x=(vision.region.bbox_x + vision.region.bbox_w / 2) if vision.region else 50,
        y=(vision.region.bbox_y + vision.region.bbox_h / 2) if vision.region else 50,
        status="answered" if answered else "open",
        source="sms", technician_id=technician.id, photo_ref=body.photo_ref, note=body.text,
        ai_confidence=vision.confidence, ai_reasoning=vision.reasoning,
        ai_diagnosis=vision.diagnosis if answered else None,
        knowledge_reuse_flag_id=reuse_match.id if reuse_match else None,
        site_knowledge_document_id=vision.site_knowledge_document.id if (answered and vision.site_knowledge_document) else None,
        routed_to_user_id=routed_to,
    )
    db.add(flag)
    db.flush()

    db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="technician",
                           sender_name=technician.name, text=body.text, photo_ref=body.photo_ref))

    # A real SMS reply is one message — everything that goes into it (OCR
    # confirmation, a past-resolution citation, then the answer/escalation
    # itself) needs to end up in the single persisted Message row too, not
    # just the transient reply_text returned from this request. Otherwise the
    # technician's thread looks different after a reload than what they
    # actually received — see the regression this fixed in MOCKS.md-adjacent
    # notes: the OCR pipeline was resolving correctly the whole time, only
    # the persisted history was silently dropping the "Read title block…"
    # confirmation.
    prefix_notes = []
    if ocr_note:
        prefix_notes.append(ocr_note)
    if reuse_match:
        engineer_msgs = [m for m in reuse_match.messages if m.sender == "engineer"]
        past_fix = engineer_msgs[-1].text if engineer_msgs else (reuse_match.ai_diagnosis or "")
        prefix_notes.append(
            f"FYI, a similar question on this drawing was resolved before: \"{reuse_match.note[:90]}\" — "
            f"the fix was: {past_fix[:180]} "
            f"Still routing this to the engineer in case your case is different."
        )

    if answered:
        ai_text = f"Tentative answer ({vision.confidence:.0f}% confidence) — {vision.diagnosis}"
        if vision.site_knowledge_document:
            ai_text += f" (cross-referenced with \"{vision.site_knowledge_document.title}\")"
        full_text = " ".join([*prefix_notes, ai_text])
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="ai", sender_name="Redline AI", text=full_text))
    else:
        routed_engineer = db.get(models.User, routed_to)
        reason = "This drawing needs manual verification first" if needs_review else vision.reasoning
        sys_text = f"Sent to {routed_engineer.name} for a direct look. ({reason})"
        full_text = " ".join([*prefix_notes, sys_text])
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="system", sender_name="Redline", text=full_text))

    reply_parts = [full_text]

    db.add(models.AuditEvent(
        id=models.gen_id(), flag_id=flag.id, drawing_id=drawing.id, actor="system",
        action="flag_created",
        detail=f"resolved via {method}" + (", backup routing" if used_backup else ""),
    ))
    reopened = False
    if drawing.status == "closed":
        drawing.status = "active"
        drawing.closed_at = None
        db.add(models.AuditEvent(
            id=models.gen_id(), drawing_id=drawing.id, actor="system",
            action="drawing_reopened", detail=f"reopened by new flag {flag.id}",
        ))
        reopened = True

    db.commit()
    db.refresh(flag)

    await manager.broadcast("flag_created", schemas.FlagOut.model_validate(flag).model_dump())
    if reopened:
        db.refresh(drawing)
        await manager.broadcast("drawing_updated", schemas.DrawingSummaryOut.model_validate(drawing).model_dump())
        reply_parts.insert(0, f"Heads up — {drawing.drawing_number} was marked fully assembled; reopening it for this.")

    return schemas.SmsInboundOut(flag=flag, reply_text=" ".join(reply_parts))
