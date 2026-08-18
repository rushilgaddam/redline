from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..services import equipment_resolver, knowledge_reuse, routing, vision_agent
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
    items = []
    for flag in flags:
        for msg in flag.messages:
            items.append({
                "flag_id": flag.id,
                "drawing_id": flag.drawing_id,
                "status": flag.status,
                "source": flag.source,
                "sender": msg.sender,
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

    drawing, method, candidates = equipment_resolver.resolve_drawing(
        db, technician.id, body.asset_tag_drawing_id or body.drawing_id_override, technician.site_ids or []
    )

    if not drawing:
        return schemas.SmsInboundOut(
            flag=None,
            reply_text="Which equipment is this about? " + " ".join(
                f"{i+1}. {c.drawing_number} — {c.title}" for i, c in enumerate(candidates)
            ),
            candidates=candidates,
        )

    photo_hint = PHOTO_HINTS.get(body.photo_ref or "", "")
    vision = vision_agent.run_vision_agent(body.text, photo_hint, drawing.regions)

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
        routed_to_user_id=routed_to,
    )
    db.add(flag)
    db.flush()

    db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="technician",
                           text=body.text, photo_ref=body.photo_ref))

    reply_parts = []
    if reuse_match:
        engineer_msgs = [m for m in reuse_match.messages if m.sender == "engineer"]
        past_fix = engineer_msgs[-1].text if engineer_msgs else (reuse_match.ai_diagnosis or "")
        reply_parts.append(
            f"FYI, a similar question on this drawing was resolved before: \"{reuse_match.note[:90]}\" — "
            f"the fix was: {past_fix[:180]} "
            f"Still routing this to the engineer in case your case is different."
        )

    if answered:
        ai_text = f"Tentative answer ({vision.confidence:.0f}% confidence) — {vision.diagnosis}"
        reply_parts.append(ai_text)
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="ai", text=ai_text))
    else:
        reason = "This drawing needs manual verification first" if needs_review else vision.reasoning
        sys_text = f"Sent to {db.get(models.User, routed_to).name} for a direct look. ({reason})"
        reply_parts.append(sys_text)
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="system", text=sys_text))

    db.add(models.AuditEvent(
        id=models.gen_id(), flag_id=flag.id, drawing_id=drawing.id, actor="system",
        action="flag_created",
        detail=f"resolved via {method}" + (", backup routing" if used_backup else ""),
    ))
    db.commit()
    db.refresh(flag)

    await manager.broadcast("flag_created", schemas.FlagOut.model_validate(flag).model_dump())

    return schemas.SmsInboundOut(flag=flag, reply_text=" ".join(reply_parts))
