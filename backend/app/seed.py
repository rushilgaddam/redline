"""Deterministic demo dataset: one org, two sites, an engineering roster, and
three fully decomposed drawings (region index + grounded context, per §3) with
enough seeded history to demonstrate knowledge reuse (§5) and the CAD-QA
background pass (§6) on first run.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import models
from .services import blueprint_kit as bp
from .services import title_block_ocr

W, H = 1000, 680


def _now_minus(hours=0, days=0):
    return datetime.now(timezone.utc) - timedelta(hours=hours, days=days)


def pct(px, py, pw, ph):
    return dict(bbox_x=round(px / W * 100, 2), bbox_y=round(py / H * 100, 2),
                bbox_w=round(pw / W * 100, 2), bbox_h=round(ph / H * 100, 2))


# ---------------------------------------------------------------- Drawing 1
def build_drawing_1():
    s = []
    s += bp.sheet_frame(W, H)
    s.append(bp.rect(60, 55, 880, 470, "outline", 6))
    for x in (280, 540, 760):
        s.append(bp.line(x, 55, x, 525, "detail"))
    s.append(bp.rect(80, 92, 840, 8, "outline"))
    s.append(bp.text(90, 84, "MAIN BUS — 480V 3PH", "label", 9, "start"))

    # CB-3 breaker cubicle
    s.append(bp.rect(90, 118, 170, 175, "detail", 3))
    s += bp.breaker_symbol(147, 145)
    s.append(bp.line(160, 100, 160, 145, "wire"))
    s.append(bp.line(170, 215, 170, 270, "wire"))
    s.append(bp.text(175, 300, "CB-3 — 100AF / 90AT", "label", 10))

    # Contactor bank K1-K4
    for i, cx in enumerate((310, 358, 406, 454)):
        s += bp.contactor_symbol(cx, 148, f"K{i+1}")
        s.append(bp.line(cx + 20, 100, cx + 20, 148, "wire"))
        s.append(bp.line(cx + 20, 204, cx + 20, 262, "wire"))
    s.append(bp.text(382, 300, "CONTACTOR BANK K1–K4", "label", 10))

    # Control transformer T1
    s += bp.transformer_symbol(600, 175)
    s.append(bp.line(610, 100, 610, 159, "wire"))
    s.append(bp.line(610, 191, 610, 255, "wire"))
    s.append(bp.text(610, 275, "CONTROL XFMR T1 — 480:120V", "label", 9.5))

    # Door interlock switch
    s.append(bp.rect(800, 150, 42, 62, "outline", 2))
    s.append(bp.circle(821, 150, 3, "detail"))
    s.append(bp.circle(821, 212, 3, "detail"))
    s.append(bp.line(821, 153, 838, 122, "detail"))
    s.append(bp.text(821, 232, "DOOR INTERLOCK SW", "label", 9.5))

    # Terminal strip TB-1
    s += bp.terminal_strip(300, 375, 8, 28, prefix="1")
    s.append(bp.text(430, 460, "TERMINAL STRIP TB-1", "label", 10))

    # Ground bus
    s.append(bp.rect(90, 458, 170, 9, "outline"))
    s += bp.ground_symbol(130, 467)
    s += bp.ground_symbol(200, 467)
    s.append(bp.text(175, 512, "GROUND BUS — GB-1", "label", 9.5))

    s += bp.dim_h(90, 930, 545, "34.00")
    s += bp.dim_v(55, 525, 34, "24.00")

    regions = [
        dict(label="CB-3 Breaker Cubicle", id_key="cb3",
             description="100AF/90AT molded-case breaker feeding the west lighting/utility load.",
             keywords=["breaker", "cb-3", "cb3", "panel", "switchgear", "trip"],
             px=(80, 105, 200, 220),
             known_issues=[dict(
                 triggers=["trip", "tripping", "tripped", "reset", "wont", "won't", "overcurrent", "hot", "smell", "burning"],
                 diagnosis="CB-3 is rated 100A frame with a 90A trip unit per rev C — repeated trips on this feeder point to sustained load above 90A continuous, not a breaker fault. Confirm actual load with a clamp meter before resetting again; do not bump the trip setting.",
                 confidence=88)]),
        dict(label="Contactor Bank K1–K4", id_key="k_bank",
             description="Four-contactor bank switching the west motor loads off the 480V bus.",
             keywords=["contactor", "k1", "k2", "k3", "k4", "coil", "bank"],
             px=(295, 105, 215, 220),
             known_issues=[dict(
                 triggers=["chatter", "chattering", "buzzing", "hum", "humming", "noise", "noisy", "coil"],
                 diagnosis="K2's coil circuit shares a control relay with the door interlock (rev C ECN-114) — chatter on K2 specifically is almost always the interlock relay contacts, not the contactor itself. Check RY-4 first.",
                 confidence=81)]),
        dict(label="Control Transformer T1", id_key="t1",
             description="480V-to-120V control power transformer for the panel's control rail.",
             keywords=["transformer", "t1", "xfmr", "control power", "120v"],
             px=(555, 100, 160, 195),
             known_issues=[dict(
                 triggers=["voltage", "low", "120v", "fluctuat", "fluctuating", "dim", "flicker"],
                 diagnosis="T1 steps 480V down to 120V control power. A sagging 120V rail across the whole panel (not just one device) traces to T1's primary fusing, F1/F2 — check those before replacing downstream components.",
                 confidence=79)]),
        dict(label="Door Interlock Switch", id_key="interlock",
             description="Mechanical interlock preventing door closure unless the main breaker is racked out.",
             keywords=["door", "interlock", "switch"],
             px=(795, 100, 175, 155),
             known_issues=[dict(
                 triggers=["door", "wont", "won't", "close", "interlock", "open", "stuck", "stay"],
                 diagnosis="Interlock plunger travel was shortened 3mm in rev C to clear the new K1 mounting bracket — a door that won't fully seat is almost always this plunger needing the updated 3mm shim, not a misaligned door.",
                 confidence=85)]),
        dict(label="Terminal Strip TB-1", id_key="tb1",
             description="8-point terminal strip carrying field wiring for the west load group per the rev C wire schedule.",
             keywords=["terminal", "tb-1", "tb1", "strip", "wiring", "wire"],
             px=(280, 350, 260, 105),
             known_issues=[dict(
                 triggers=["loose", "wire", "wiring", "label", "numbering", "mismatch", "tag"],
                 diagnosis="TB-1 terminal numbering was renumbered in rev C to match the new wire schedule — if field ferrules still show rev B numbers, the terminals themselves are correct; re-tag ferrules from the rev C wire list, don't rewire.",
                 confidence=76)]),
        dict(label="Ground Bus GB-1", id_key="gb1",
             description="Panel ground bus, bonded to the enclosure and building steel.",
             keywords=["ground", "gb-1", "gb1", "bus", "bond", "earth"],
             px=(80, 448, 200, 90), known_issues=[]),
    ]
    return dict(viewBox=[0, 0, W, H], shapes=s), regions


# ---------------------------------------------------------------- Drawing 2
def build_drawing_2():
    s = []
    s += bp.sheet_frame(W, H)
    s.append(bp.rect(120, 150, 760, 350, "outline", 4))
    s.append(bp.centerline_h(140, 880, 330))
    s.append(bp.centerline_v(160, 500, 500))
    s += bp.motor_symbol(500, 330, 105)
    s.append(bp.text(500, 460, "DRIVE MOTOR — 15HP 1180RPM", "label", 9.5))

    # mounting slots
    s.append(bp.rect(158, 178, 74, 26, "outline", 13))
    s.append(bp.rect(768, 178, 74, 26, "outline", 13))
    s.append(bp.text(195, 168, "SLOT-L", "tag", 8.5))
    s.append(bp.text(805, 168, "SLOT-R", "tag", 8.5))

    # base plate bolt row
    for bx in (180, 330, 480, 630, 780):
        s.append(bp.circle(bx, 468, 8, "outline"))
    s.append(bp.centerline_h(150, 850, 468))
    s.append(bp.text(500, 500, "MOTOR BASE PLATE — GR.8 HDWR", "label", 9.5))

    # belt tensioner assembly
    s.append(bp.circle(880, 300, 9, "outline"))
    s.append(bp.line(880, 300, 946, 262, "outline"))
    s.append(bp.circle(946, 262, 24, "outline"))
    s.append(bp.path("M 892 316 q 8 10 0 20 q -8 10 0 20", "detail"))
    s.append(bp.text(915, 360, "BELT TENSIONER", "label", 9))

    # coupling guard (dashed)
    s.append(bp.rect(122, 288, 96, 88, "guard", 4))
    s.append(bp.circle(170, 332, 20, "detail"))
    s.append(bp.text(170, 392, "COUPLING GUARD", "label", 9))

    # lube port
    s.append(bp.circle(820, 420, 10, "outline"))
    s.append(bp.line(820, 410, 820, 393, "detail"))
    s.append(bp.text(820, 445, "LUBE PORT", "tag", 8.5))

    # GD&T + leader
    s += bp.gdt_frame(140, 545, "⟂", "0.05", "A")
    s.append(bp.line(190, 545, 195, 204, "leader"))

    s += bp.dim_h(120, 880, 130, "30.000")
    s += bp.dim_v(150, 500, 100, "17.000")

    regions = [
        dict(label="Upper Mounting Slot — Left", id_key="slot_l",
             description="Left slotted mount, widened for lateral belt-tracking adjustment.",
             keywords=["slot", "mount", "mounting", "left"],
             px=(150, 165, 100, 45),
             known_issues=[dict(
                 triggers=["crack", "cracked", "elong", "elongat", "worn", "wear", "walk", "walking", "shift", "shifted", "shifting"],
                 diagnosis="The left slot was widened 4mm in rev B to add lateral adjustment for belt tracking — if the mount is 'walking' during operation, retorque to the rev B spec (85 ft-lb) with the bolt at the slot's inboard edge, not centered.",
                 confidence=83)]),
        dict(label="Upper Mounting Slot — Right", id_key="slot_r",
             description="Right slotted mount, fixed position, datum reference for the mounting pattern.",
             keywords=["slot", "mount", "mounting", "right"],
             px=(760, 165, 100, 45), known_issues=[]),
        dict(label="Motor Base Plate", id_key="base_plate",
             description="Base plate bolt pattern, Grade 8 hardware per rev B vibration fix.",
             keywords=["plate", "base", "bolt", "bolts", "motor mount", "torque"],
             px=(120, 395, 760, 115),
             known_issues=[dict(
                 triggers=["vibration", "vibrating", "shake", "shaking", "loose", "bolt", "bolts", "torque"],
                 diagnosis="Base plate bolt pattern was upgraded to Grade 8 in rev B after field vibration reports — if the bolts are still original Grade 5 (no hash marks on the head), that's the vibration source, not a motor balance issue.",
                 confidence=84)]),
        dict(label="Belt Tensioner Assembly", id_key="tensioner",
             description="Spring-loaded tensioner arm, 3.25in free-length spring per rev B.",
             keywords=["tensioner", "belt", "spring", "arm"],
             px=(855, 225, 145, 165),
             known_issues=[dict(
                 triggers=["belt", "slipping", "slip", "loose", "tension", "squeal", "squealing"],
                 diagnosis="Tensioner spring free-length spec is 3.25in per rev B — a belt slipping under load even with the arm at full travel means the spring is past service life, not that the arm needs more adjustment range.",
                 confidence=80)]),
        dict(label="Coupling Guard", id_key="guard",
             description="Removable dashed-outline guard over the motor-to-shaft coupling.",
             keywords=["guard", "coupling", "shaft"],
             px=(112, 278, 116, 105), known_issues=[]),
        dict(label="Lubrication Port", id_key="lube",
             description="Flush-style Zerk fitting for the shaft bearing, updated in rev B.",
             keywords=["lube", "lubrication", "grease", "port", "fitting"],
             px=(785, 380, 75, 75),
             known_issues=[dict(
                 triggers=["grease", "lube", "lubrication", "leak", "leaking", "fitting"],
                 diagnosis="Lube port fitting was changed to a flush-style Zerk in rev B — a standard button-head grease gun won't seat on it and will look like it's 'leaking' when it's actually just not engaging. Use the flush-tip adapter from the rev B parts note.",
                 confidence=82)]),
    ]
    return dict(viewBox=[0, 0, W, H], shapes=s), regions


# ---------------------------------------------------------------- Drawing 3
def build_drawing_3():
    s = []
    s += bp.sheet_frame(W, H)
    s.append(bp.rect(60, 55, 880, 470, "outline", 6))
    s.append(bp.rect(120, 75, 10, 440, "outline"))
    s.append(bp.text(140, 70, "MAIN BUS — 800A CU", "label", 9, "start"))

    s.append(bp.rect(150, 80, 100, 130, "detail", 3))
    s += bp.breaker_symbol(177, 100)
    s.append(bp.line(130, 130, 177, 130, "wire"))
    s.append(bp.text(200, 225, "MAIN BKR — 800A / 1000AF", "label", 9.5))

    s.append(bp.line(130, 300, 610, 300, "wire"))
    feeder_xs = [280, 380, 480, 580]
    for i, x in enumerate(feeder_xs):
        s += bp.breaker_symbol(x, 260)
        cx = x + 23
        s.append(bp.line(cx, 300, cx, 260, "wire"))
        s.append(bp.text(cx, 410, f"F{i+1}", "tag", 9))
    s.append(bp.text(480, 425, "FEEDER BREAKER 3 — 400A", "label", 9.5))

    s.append(bp.rect(700, 90, 180, 140, "detail", 3))
    for cx in (740, 790, 840):
        s.append(bp.circle(cx, 145, 15, "outline"))
    s.append(bp.text(790, 250, "CT COMPARTMENT — 800:5", "label", 9.5))

    s.append(bp.rect(700, 300, 220, 165, "detail", 3))
    for i in range(9):
        rx, ry = 715 + (i % 3) * 68, 315 + (i // 3) * 48
        s.append(bp.rect(rx, ry, 40, 34, "outline", 2))
        s.append(bp.text(rx + 20, ry + 47, f"RY-{i+1}", "tag", 7.5))
    s.append(bp.text(810, 485, "RELAY / PROTECTION PANEL", "label", 9.5))

    s += bp.dim_h(60, 940, 545, "44.00")
    s += bp.dim_v(55, 525, 34, "24.00")

    regions = [
        dict(label="Main Breaker", id_key="main_bkr",
             description="800A main breaker, 1000AF frame, incoming from utility.",
             keywords=["main", "breaker", "800a", "mainbkr"],
             px=(140, 65, 130, 175),
             known_issues=[dict(
                 triggers=["main", "trip", "tripped", "close", "wont", "won't", "racking", "racked"],
                 diagnosis="The main breaker close-coil interlock was changed in rev A to require F1–F4 racked to test position first — if MAIN won't close, check that the feeders are fully in test, not a main breaker fault.",
                 confidence=86)]),
        dict(label="Feeder Breaker 3", id_key="feeder3",
             description="400A feeder breaker serving the highest-inrush line on this panel.",
             keywords=["feeder", "f3", "breaker3", "feeder3"],
             px=(460, 240, 100, 195),
             known_issues=[dict(
                 triggers=["feeder", "f3", "trip", "tripped", "reset", "wont", "won't", "nuisance"],
                 diagnosis="F3 feeds the highest-inrush line on this panel per the rev A load study — nuisance trips on F3 alone, with F1/F2/F4 clean, point to the trip unit's short-time pickup still at the rev-0 setting; verify against the rev A coordination study before swapping the breaker.",
                 confidence=87)]),
        dict(label="Bus Bar Section", id_key="bus",
             description="800A copper bus bar, vertical riser from the main to the feeder section.",
             keywords=["bus", "busbar", "bus bar", "riser"],
             px=(100, 65, 60, 460), known_issues=[]),
        dict(label="CT Compartment", id_key="ct",
             description="800:5 ratio current transformers, upgraded from 600:5 in rev A.",
             keywords=["ct", "current transformer", "compartment"],
             px=(690, 80, 200, 190),
             known_issues=[dict(
                 triggers=["ct", "reading", "meter", "reads", "zero", "wrong", "low"],
                 diagnosis="CTs on this bus are 800:5 ratio per the rev A nameplate, but panel meters were left configured for the old 600:5 ratio before the rev A upgrade — a reading consistently low by roughly 25% is almost always an unmigrated meter CT ratio setting, not a wiring fault.",
                 confidence=78)]),
        dict(label="Relay Panel", id_key="relay",
             description="9-slot protection relay grid for the feeder section.",
             keywords=["relay", "ry", "protection", "panel"],
             px=(690, 290, 240, 200), known_issues=[]),
    ]
    return dict(viewBox=[0, 0, W, H], shapes=s), regions


def _make_regions(db: Session, drawing_id: str, region_specs: list[dict]) -> dict[str, models.Region]:
    out = {}
    for spec in region_specs:
        px, py, pw, ph = spec["px"]
        region = models.Region(
            id=models.gen_id(), drawing_id=drawing_id, label=spec["label"],
            description=spec["description"], keywords=spec["keywords"],
            known_issues=spec["known_issues"], **pct(px, py, pw, ph),
        )
        db.add(region)
        out[spec["id_key"]] = region
    return out


def _seed_flag(db: Session, *, drawing_id, region, x, y, status, source, technician_id=None,
               photo_ref=None, note, ai_confidence=None, ai_reasoning=None, ai_diagnosis=None,
               routed_to, created_hours_ago, resolved_hours_ago=None, thread):
    flag = models.Flag(
        id=models.gen_id(), drawing_id=drawing_id, region_id=region.id if region else None,
        x=x, y=y, status=status, source=source, technician_id=technician_id, photo_ref=photo_ref,
        note=note, ai_confidence=ai_confidence, ai_reasoning=ai_reasoning, ai_diagnosis=ai_diagnosis,
        routed_to_user_id=routed_to, created_at=_now_minus(hours=created_hours_ago),
        resolved_at=_now_minus(hours=resolved_hours_ago) if resolved_hours_ago is not None else None,
    )
    db.add(flag)
    technician = db.get(models.User, technician_id) if technician_id else None
    engineer = db.get(models.User, routed_to) if routed_to else None
    sender_names = {
        "technician": technician.name if technician else None,
        "engineer": engineer.name if engineer else None,
        "ai": "Redline AI",
        "system": "Redline",
    }
    for m in thread:
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender=m[0], sender_name=sender_names.get(m[0]),
                               text=m[1], photo_ref=m[2] if len(m) > 2 else None,
                               created_at=_now_minus(hours=m[3] if len(m) > 3 else created_hours_ago)))
    return flag


def seed(db: Session):
    if db.query(models.Organization).first():
        return

    org = models.Organization(id=models.gen_id(), name="Meridian Fabrication", retention_days=180)
    db.add(org)
    site_cary = models.Site(id=models.gen_id(), org_id=org.id, name="Cary Plant — Line 1", address="Cary, NC")
    site_grn = models.Site(id=models.gen_id(), org_id=org.id, name="Greenville Plant — Line 4", address="Greenville, SC")
    db.add_all([site_cary, site_grn])

    marisol = models.User(id=models.gen_id(), org_id=org.id, role="engineer", name="Marisol Rivera",
                           email="marisol.rivera@meridianfab.com", discipline="Electrical",
                           title="Senior Electrical Engineer", avatar_color="#3ee6c4", site_ids=[site_cary.id])
    daniel = models.User(id=models.gen_id(), org_id=org.id, role="engineer", name="Daniel Cho",
                          email="daniel.cho@meridianfab.com", discipline="Electrical",
                          title="Electrical Engineer II", avatar_color="#7aa2ff", site_ids=[site_cary.id, site_grn.id])
    priya = models.User(id=models.gen_id(), org_id=org.id, role="engineer", name="Priya Natarajan",
                         email="priya.natarajan@meridianfab.com", discipline="Mechanical",
                         title="Mechanical Engineer", avatar_color="#ff9d5c", out_of_office=True, site_ids=[site_cary.id])
    owen = models.User(id=models.gen_id(), org_id=org.id, role="reviewer", name="Owen Baptiste",
                        email="owen.baptiste@meridianfab.com", discipline="Mechanical",
                        title="Engineering Lead", avatar_color="#c792ea", site_ids=[site_cary.id, site_grn.id])
    priya.backup_user_id = owen.id

    jake = models.User(id=models.gen_id(), org_id=org.id, role="technician", name="Jake Alvarez",
                        phone="+15550102938", avatar_color="#f4c95d", site_ids=[site_cary.id])
    dana = models.User(id=models.gen_id(), org_id=org.id, role="technician", name="Dana Whitfield",
                        phone="+15550107742", avatar_color="#ff7a7a", site_ids=[site_cary.id, site_grn.id])
    db.add_all([marisol, daniel, priya, owen, jake, dana])
    db.flush()

    # ---------------- Drawing 1: E-1042 Rev C — MCC Panel B (Electrical, Cary)
    layout1, specs1 = build_drawing_1()
    d1 = models.Drawing(
        id=models.gen_id(), site_id=site_cary.id, drawing_number="E-1042", revision="C",
        title="Motor Control Center — Panel B", discipline="Electrical",
        primary_author_id=marisol.id, backup_author_ids=[daniel.id],
        context_block=(
            "Panel B feeds the west-line 480V loads off the plant's main switchgear. Rev C (ECN-114) "
            "relocated K1's mounting bracket, shortened the door interlock plunger travel by 3mm to clear it, "
            "and renumbered TB-1 to match the updated wire schedule. Trip unit on CB-3 is fixed at 90A; "
            "do not field-adjust. T1 primary fusing is F1/F2."
        ),
        revision_notes="Rev C (ECN-114): K1 bracket relocated, door interlock plunger shortened 3mm, TB-1 renumbered.",
        confidence_floor_status="verified", layout=layout1, cad_qa_scanned=True,
    )
    db.add(d1)
    db.flush()
    r1 = _make_regions(db, d1.id, specs1)
    d1.cad_qa_findings = [
        dict(region_id=r1["tb1"].id, x=41, y=57,
             finding="Wire count entering TB-1 (8 leads shown) doesn't match the rev C wire schedule note, which calls out 9 conductors for this run — possible missing conductor or an unupdated schedule.",
             confidence=72, reasoning="Deterministic check: drawn terminal count vs. wire-schedule cross-reference.",
             check_type="wire_count_vs_schedule"),
        dict(region_id=r1["k_bank"].id, x=38, y=22,
             finding="K3's coil circuit reference (RY-4) does not appear in the relay list on sheet 2 — orphaned reference, likely left over from before ECN-114.",
             confidence=66, reasoning="Critic pass: cross-view reference audit found a symbol without a schedule entry.",
             check_type="orphaned_reference"),
    ]

    # ---------------- Drawing 2: M-2210 Rev B — Conveyor Drive Motor Mount 12C (Mechanical, Cary)
    layout2, specs2 = build_drawing_2()
    d2 = models.Drawing(
        id=models.gen_id(), site_id=site_cary.id, drawing_number="M-2210", revision="B",
        title="Conveyor Drive Motor Mount 12C", discipline="Mechanical",
        primary_author_id=priya.id, backup_author_ids=[owen.id],
        context_block=(
            "Motor mount 12C carries the 15HP drive motor for conveyor line 12. Rev B widened the left "
            "mounting slot 4mm for belt-tracking adjustment, upgraded base plate hardware to Grade 8 after "
            "field vibration reports, specified a 3.25in free-length tensioner spring, and changed the lube "
            "fitting to a flush-style Zerk."
        ),
        revision_notes="Rev B: left slot widened 4mm, base plate hardware upgraded to Grade 8, flush-style lube fitting.",
        confidence_floor_status="verified", layout=layout2, cad_qa_scanned=False,
    )
    db.add(d2)
    db.flush()
    r2 = _make_regions(db, d2.id, specs2)
    d2.cad_qa_findings = [
        dict(region_id=r2["slot_r"].id, x=79, y=27,
             finding="Right mounting slot GD&T callout references datum B, but datum B is not defined anywhere on this sheet — likely dropped when the datum scheme was revised for rev B.",
             confidence=70, reasoning="Critic pass: GD&T datum reference audit found a callout pointing to an undefined datum.",
             check_type="gdt_datum_consistency"),
        dict(region_id=r2["tensioner"].id, x=90, y=39,
             finding="Tensioner arm pivot bolt callout (3/8-16 x 2.5) is 0.25in shorter than the stack-up of arm boss + washer + nut shown in the section view — thread engagement may be marginal.",
             confidence=74, reasoning="Deterministic check: fastener length vs. clamped-stack thickness.",
             check_type="fastener_stackup"),
    ]

    # ---------------- Drawing 3: E-3305 Rev A — Switchgear Panel B Feeder (Electrical, Greenville)
    layout3, specs3 = build_drawing_3()
    d3 = models.Drawing(
        id=models.gen_id(), site_id=site_grn.id, drawing_number="E-3305", revision="A",
        title="Switchgear Panel B — Feeder Section", discipline="Electrical",
        primary_author_id=daniel.id, backup_author_ids=[marisol.id],
        context_block=(
            "Feeder section off the plant's 800A main switchgear. Rev A upgraded CTs from 600:5 to 800:5 "
            "and requires feeder breakers racked to test before the main will close. F3 carries the highest "
            "inrush load per the rev A coordination study."
        ),
        revision_notes="Rev A: CTs upgraded to 800:5, main close-coil interlock now requires feeders racked to test.",
        confidence_floor_status="verified", layout=layout3, cad_qa_scanned=False,
    )
    db.add(d3)
    db.flush()
    r3 = _make_regions(db, d3.id, specs3)
    d3.cad_qa_findings = [
        dict(region_id=r3["bus"].id, x=15, y=61,
             finding="Bus bar section shows 800A busbar sizing, but the main breaker frame is called out at 1000AF — bus may be undersized relative to the breaker frame rating; confirm against the short-circuit study.",
             confidence=69, reasoning="Deterministic check: busbar ampacity vs. upstream breaker frame size.",
             check_type="ampacity_mismatch"),
        dict(region_id=r3["relay"].id, x=76, y=61,
             finding="RY-6 appears in the relay panel grid but has no corresponding trip-logic entry on the protection schedule — orphaned device.",
             confidence=63, reasoning="Critic pass: device-to-schedule cross-reference.",
             check_type="orphaned_reference"),
    ]

    db.flush()

    # Real title-block thumbnails for the OCR resolver — see title_block_ocr.py.
    for drawing, author in ((d1, marisol), (d2, priya), (d3, daniel)):
        title_block_ocr.save_title_block_image(drawing, author.name)

    # ---------------- CAD-QA flags for the already-scanned drawing (d1)
    for f in d1.cad_qa_findings:
        flag = models.Flag(id=models.gen_id(), drawing_id=d1.id, region_id=f["region_id"], x=f["x"], y=f["y"],
                            status="open", source="cad_qa", note=f["finding"], ai_confidence=f["confidence"],
                            ai_reasoning=f["reasoning"], routed_to_user_id=marisol.id,
                            created_at=_now_minus(hours=41))
        db.add(flag)
        db.flush()
        db.add(models.Message(id=models.gen_id(), flag_id=flag.id, sender="ai", sender_name="Redline AI", text=f["finding"],
                               created_at=_now_minus(hours=41)))

    # ---------------- Live seeded flags (variety across status/discipline for a populated inbox)
    _seed_flag(
        db, drawing_id=d1.id, region=r1["k_bank"], x=38, y=24, status="answered", source="sms",
        technician_id=jake.id, photo_ref="mock:contactor_bank",
        note="K2 keeps chattering on and off when the line starts up, kind of a buzzing noise",
        ai_confidence=81, routed_to=marisol.id, created_hours_ago=5,
        ai_reasoning="Photo/note language overlaps strongly with \"Contactor Bank K1–K4\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="K2's coil circuit shares a control relay with the door interlock (rev C ECN-114) — chatter on K2 specifically is almost always the interlock relay contacts, not the contactor itself. Check RY-4 first.",
        thread=[
            ("technician", "K2 keeps chattering on and off when the line starts up, kind of a buzzing noise", "mock:contactor_bank", 5),
            ("ai", "Tentative match: Contactor Bank K1–K4 (81% confidence). K2's coil circuit shares a control relay with the door interlock (rev C ECN-114) — chatter on K2 specifically is almost always the interlock relay contacts, not the contactor itself. Check RY-4 first.", None, 5),
        ],
    )
    _seed_flag(
        db, drawing_id=d1.id, region=r1["gb1"], x=15, y=68, status="open", source="sms",
        technician_id=dana.id, photo_ref="mock:ground_bus",
        note="not sure if this ground bus connection looks right, seems corroded",
        ai_confidence=41, routed_to=marisol.id, created_hours_ago=2,
        ai_reasoning="Best region match is \"Ground Bus GB-1\", but the drawing's context block doesn't contain a grounded explanation for this symptom — declining to guess.",
        thread=[
            ("technician", "not sure if this ground bus connection looks right, seems corroded", "mock:ground_bus", 2),
            ("system", "Sent to Marisol Rivera for a direct look.", None, 2),
        ],
    )
    _seed_flag(
        db, drawing_id=d2.id, region=r2["slot_l"], x=20, y=28, status="answered", source="sms",
        technician_id=jake.id, photo_ref="mock:mounting_slot",
        note="left mount looks like it's shifting a little, bolt might be loose",
        ai_confidence=83, routed_to=owen.id, created_hours_ago=8,
        ai_reasoning="Photo/note language overlaps strongly with \"Upper Mounting Slot — Left\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="The left slot was widened 4mm in rev B to add lateral adjustment for belt tracking — if the mount is 'walking' during operation, retorque to the rev B spec (85 ft-lb) with the bolt at the slot's inboard edge, not centered.",
        thread=[
            ("technician", "left mount looks like it's shifting a little, bolt might be loose", "mock:mounting_slot", 8),
            ("ai", "Tentative match: Upper Mounting Slot — Left (83% confidence). The left slot was widened 4mm in rev B for belt-tracking adjustment — if the mount is 'walking', retorque to the rev B spec (85 ft-lb) with the bolt at the slot's inboard edge, not centered.", None, 8),
        ],
    )
    _seed_flag(
        db, drawing_id=d3.id, region=r3["relay"], x=80, y=63, status="open", source="sms",
        technician_id=dana.id, photo_ref="mock:relay_panel",
        note="RY-6 has a fault light on, not sure what it's for",
        ai_confidence=35, routed_to=daniel.id, created_hours_ago=1,
        ai_reasoning="Best region match is \"Relay Panel\", but the drawing's context block doesn't contain a grounded explanation for this symptom — declining to guess.",
        thread=[
            ("technician", "RY-6 has a fault light on, not sure what it's for", "mock:relay_panel", 1),
            ("system", "Sent to Daniel Cho for a direct look.", None, 1),
        ],
    )

    # ---------------- Resolved history (fuel for knowledge reuse §5)
    _seed_flag(
        db, drawing_id=d1.id, region=r1["cb3"], x=17, y=20, status="resolved", source="sms",
        technician_id=jake.id, photo_ref="mock:breaker_cb3",
        note="CB3 breaker tripped again during the night shift, reset but it happened twice",
        ai_confidence=88, routed_to=marisol.id, created_hours_ago=96, resolved_hours_ago=90,
        ai_reasoning="Photo/note language overlaps strongly with \"CB-3 Breaker Cubicle\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="CB-3 is rated 100A frame with a 90A trip unit — repeated trips point to sustained load above 90A, not a breaker fault. Confirm actual load before resetting again.",
        thread=[
            ("technician", "CB3 breaker tripped again during the night shift, reset but it happened twice", "mock:breaker_cb3", 96),
            ("ai", "Tentative match: CB-3 Breaker Cubicle (88% confidence). CB-3 is rated 100A frame with a 90A trip unit — repeated trips point to sustained load above 90A, not a breaker fault.", None, 96),
            ("engineer", "Confirmed — measured 96A continuous on that feeder, above the 90A trip setting. Moved the space heater circuit off CB-3 this morning. Do not adjust the trip unit.", None, 92),
            ("technician", "got it, that fixed it, thanks", None, 90),
        ],
    )
    _seed_flag(
        db, drawing_id=d1.id, region=r1["interlock"], x=82, y=18, status="resolved", source="sms",
        technician_id=dana.id, photo_ref="mock:door_interlock",
        note="door interlock won't let the panel door close all the way",
        ai_confidence=85, routed_to=marisol.id, created_hours_ago=150, resolved_hours_ago=147,
        ai_reasoning="Photo/note language overlaps strongly with \"Door Interlock Switch\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="Interlock plunger travel was shortened 3mm in rev C — a door that won't seat is almost always the plunger needing the updated shim, not a misaligned door.",
        thread=[
            ("technician", "door interlock won't let the panel door close all the way", "mock:door_interlock", 150),
            ("ai", "Tentative match: Door Interlock Switch (85% confidence). Plunger travel was shortened 3mm in rev C — likely needs the updated shim, not a misaligned door.", None, 150),
            ("engineer", "Yep — swapped in the 3mm shim from the rev C parts kit, door seats fine now.", None, 148),
        ],
    )
    _seed_flag(
        db, drawing_id=d2.id, region=r2["tensioner"], x=91, y=41, status="resolved", source="sms",
        technician_id=jake.id, photo_ref="mock:belt_tensioner",
        note="belt keeps slipping even with the tensioner cranked all the way over",
        ai_confidence=80, routed_to=owen.id, created_hours_ago=200, resolved_hours_ago=196,
        ai_reasoning="Photo/note language overlaps strongly with \"Belt Tensioner Assembly\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="Tensioner spring free-length spec is 3.25in — slipping under load even at full arm travel means the spring is past service life, not that the arm needs more range.",
        thread=[
            ("technician", "belt keeps slipping even with the tensioner cranked all the way over", "mock:belt_tensioner", 200),
            ("ai", "Tentative match: Belt Tensioner Assembly (80% confidence). Spring free-length spec is 3.25in — likely past service life.", None, 200),
            ("engineer", "Measured 2.6in free length, well under spec. Replaced spring, belt holds tension fine now.", None, 197),
        ],
    )
    _seed_flag(
        db, drawing_id=d3.id, region=r3["ct"], x=79, y=42, status="resolved", source="sms",
        technician_id=dana.id, photo_ref="mock:ct_meter",
        note="CT meter reading seems way lower than expected on this feeder",
        ai_confidence=78, routed_to=daniel.id, created_hours_ago=260, resolved_hours_ago=255,
        ai_reasoning="Photo/note language overlaps strongly with \"CT Compartment\" and matches a known failure pattern recorded in this drawing's context block.",
        ai_diagnosis="CTs are 800:5 ratio per rev A, but panel meters may still be configured for the old 600:5 ratio — check the meter's CT ratio setting before assuming a wiring fault.",
        thread=[
            ("technician", "CT meter reading seems way lower than expected on this feeder", "mock:ct_meter", 260),
            ("ai", "Tentative match: CT Compartment (78% confidence). CTs are 800:5 per rev A — check the meter's ratio setting.", None, 260),
            ("engineer", "Meter was still set to 600:5 from before the upgrade. Reconfigured, readings match a clamp meter now.", None, 256),
        ],
    )

    # ---------------- Site Knowledge Agent demo data (mocked — see MOCKS.md)
    cary_outlook = models.KnowledgeSource(
        id=models.gen_id(), site_id=site_cary.id, type="outlook",
        display_name="Marisol Rivera's Outlook", connected_by_user_id=marisol.id,
        status="connected", connected_at=_now_minus(hours=72),
        scope_kind="labels", scope_items=["Label: Panel B", "Label: Corrosion follow-up"],
    )
    grn_teams = models.KnowledgeSource(
        id=models.gen_id(), site_id=site_grn.id, type="teams",
        display_name="#line-4-electrical", connected_by_user_id=daniel.id,
        status="connected", connected_at=_now_minus(hours=50),
        scope_kind="channels", scope_items=["Channel: #line-4-electrical"],
    )
    db.add_all([cary_outlook, grn_teams])
    db.flush()

    db.add(models.KnowledgeDocument(
        id=models.gen_id(), source_id=cary_outlook.id, site_id=site_cary.id,
        title="RE: GB-1 ground bus corrosion — Panel B", author="Marisol Rivera",
        occurred_at=_now_minus(hours=70),
        content=(
            "Following up from the walkdown last week — the ground bus GB-1 on Panel B was showing "
            "surface corrosion/oxidation at the lug connections, not a bonding failure. Maintenance "
            "cleaned and re-torqued the lugs to 35 ft-lb and applied anti-oxidant compound. If a tech "
            "reports the ground bus looking corroded again on this panel, it's very likely just surface "
            "oxidation from the humidity in that corner of the building — clean and re-torque, no need "
            "to escalate as a bonding issue unless resistance testing says otherwise."
        ),
        keywords=["ground bus", "gb-1", "corrosion", "corroded", "oxidation", "panel b", "lug"],
    ))
    db.add(models.KnowledgeDocument(
        id=models.gen_id(), source_id=grn_teams.id, site_id=site_grn.id,
        title="RY-6 fault light — known nuisance since CT upgrade", author="Daniel Cho",
        occurred_at=_now_minus(hours=48),
        content=(
            "Heads up team — RY-6 on the relay panel has been throwing a fault/alarm light intermittently "
            "since the rev A CT upgrade. Root cause: RY-6's own auxiliary contact wiring wasn't updated "
            "for the new 800:5 CTs and it's tripping on a benign mismatch, not a real fault. It's cosmetic "
            "until we get the relay reprogrammed next shutdown — don't chase it as an emergency, just note "
            "it in the shift log."
        ),
        keywords=["ry-6", "relay", "fault light", "alarm", "relay panel", "ct upgrade"],
    ))

    db.commit()
